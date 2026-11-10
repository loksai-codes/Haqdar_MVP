import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { initFalkorDB, execute_falkordb_cypher, getGraphTopology } from './server/falkordb-service.ts';
import { performHaqdarReasoning, CitizenProfile } from './server/agent-reasoning.ts';
import { parseCitizenIntake } from './server/intake-agent.ts';

dotenv.config({ path: '.env.local' });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProduction = process.env.NODE_ENV === 'production';

async function bootstrap() {
  const app = express();
  app.use(express.json());

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
      console.error('[API /api/intake/parse] error:', err);
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
      console.error('[API /api/graph/reason] error:', err);
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
      console.error('[API /api/graph/cypher] error:', err);
      res.status(500).json({ error: err.message || 'Cypher query execution failed' });
    }
  });

  // 4. GRAPH TOPOLOGY: For interactive visualization
  app.get('/api/graph/topology', (req: Request, res: Response) => {
    res.json(getGraphTopology());
  });

  // Mount Vite or static server
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Haqdar Core] Server running on http://0.0.0.0:${PORT}`);
  });
}

bootstrap().catch(err => {
  console.error('[Haqdar] Bootstrap error:', err);
  process.exit(1);
});
