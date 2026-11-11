import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initFalkorDB, execute_falkordb_cypher, getGraphTopology } from './server/falkordb-service.ts';
import { performHaqdarReasoning } from './server/agent-reasoning.ts';
import type { CitizenProfile } from './server/agent-reasoning.ts';
import { parseCitizenIntake } from './server/intake-agent.ts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '8080', 10);
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  // CORS and security headers for API routes
  app.use('/api', (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Initialize FalkorDB connection in background
  initFalkorDB().catch(err => {
    console.warn('[FalkorDB] Background init message:', err.message);
  });

  // ==========================================
  // API ROUTES
  // ==========================================

  // Health & FalkorDB status
  app.get('/api/health', (req: Request, res: Response) => {
    const topology = getGraphTopology();
    res.json({
      status: 'ok',
      engine: 'Haqdar Multi-Agent Reasoning Core',
      environment: isProduction ? 'production' : 'development',
      groq: {
        configured: Boolean(process.env.GROQ_API_KEY)
      },
      falkordb: {
        host: topology.meta.cloudHost,
        connected: topology.meta.connectedCloud,
        nodes: topology.meta.totalNodes,
        edges: topology.meta.totalEdges
      }
    });
  });

  // 1. INTAKE AGENT: Multilingual voice/text parsing with Aadhaar privacy guard
  app.post('/api/intake/parse', async (req: Request, res: Response) => {
    try {
      const { text, language } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text input is required' });
      }

      const result = await parseCitizenIntake(text, language || 'en');
      res.json(result);
    } catch (err: any) {
      console.error('[API /api/intake/parse] error:', err?.message || 'Unknown error');
      res.status(500).json({ error: err.message || 'Intake parsing failed' });
    }
  });

  // 2. GRAPH REASONING & ACTION AGENT: Complete grounded workflow
  app.post('/api/graph/reason', async (req: Request, res: Response) => {
    try {
      const profile: CitizenProfile = req.body;
      if (!profile || !profile.state || typeof profile.age !== 'number') {
        return res.status(400).json({ error: 'Valid citizen profile with state and age is required' });
      }

      const result = await performHaqdarReasoning(profile);
      res.json(result);
    } catch (err: any) {
      console.error('[API /api/graph/reason] error:', err?.message || 'Unknown error');
      res.status(500).json({ error: err.message || 'Graph reasoning failed' });
    }
  });

  // 3. FALKORDB CYPHER TOOL: Direct openCypher execution endpoint
  app.post('/api/graph/cypher', async (req: Request, res: Response) => {
    try {
      const { query, params } = req.body;
      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'openCypher query string is required' });
      }

      const result = await execute_falkordb_cypher(query, params || {});
      res.json(result);
    } catch (err: any) {
      console.error('[API /api/graph/cypher] error:', err?.message || 'Unknown error');
      res.status(500).json({ error: err.message || 'Cypher query execution failed' });
    }
  });

  // 4. GRAPH TOPOLOGY: For interactive visualization
  app.get('/api/graph/topology', (req: Request, res: Response) => {
    res.json(getGraphTopology());
  });

  // Ensure unmatched API routes return JSON 404 rather than SPA HTML
  app.all('/api/*', (req: Request, res: Response) => {
    res.status(404).json({ error: 'API route not found' });
  });

  // Mount Vite (development only) or static production server
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distDir, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Haqdar Core] Server running on http://0.0.0.0:${PORT} (${isProduction ? 'production' : 'development'})`);
  });

  // Reasonable HTTP timeouts for Cloud Run
  server.requestTimeout = 30000;
  server.headersTimeout = 35000;
  server.keepAliveTimeout = 65000;

  const shutdown = (signal: string) => {
    console.log(`[Haqdar Core] Received ${signal}, shutting down gracefully...`);
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

bootstrap().catch(err => {
  console.error('[Haqdar] Bootstrap error:', err);
  process.exit(1);
});
