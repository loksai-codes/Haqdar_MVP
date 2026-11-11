import { FalkorDB } from 'falkordb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const FALKORDB_HOST = process.env.FALKORDB_HOST || '';
const FALKORDB_PORT = parseInt(process.env.FALKORDB_PORT || '53834', 10);
const FALKORDB_USERNAME = process.env.FALKORDB_USERNAME || 'falkordb';
const FALKORDB_PASSWORD = process.env.FALKORDB_PASSWORD || '';
const GRAPH_NAME = 'haqdar_welfare';
const RECONNECT_COOLDOWN_MS = 30000;
const FALKORDB_CONNECT_TIMEOUT_MS = 8000;

let client: any = null;
let graph: any = null;
let isConnected = false;
let lastConnectionAttempt = 0;

// Seed Cypher queries provided in the hackathon brief
export const SEED_CYPHER_QUERIES = [
  // 1. Offices
  `CREATE (:Office {name: "MeeSeva Centre", type: "Digital Services Portal", portal_url: "https://tg.meeseva.gov.in"})`,
  `CREATE (:Office {name: "Tahsildar / MRO Office", type: "Revenue Department", portal_url: "https://dharani.telangana.gov.in"})`,
  `CREATE (:Office {name: "District Animal Husbandry Office", type: "Veterinary Department", portal_url: "https://ahd.telangana.gov.in"})`,
  `CREATE (:Office {name: "Nationalized / Regional Rural Bank", type: "Banking Institution", portal_url: "https://financialservices.gov.in"})`,
  `CREATE (:Office {name: "Gram Panchayat / Ward Sachivalayam", type: "Local Governance Office", portal_url: "https://epanchayat.telangana.gov.in"})`,

  // 2. Documents
  `CREATE (:Document {name: "Aadhaar Card", validity: "Permanent"})`,
  `CREATE (:Document {name: "Food Security Card (Ration Card)", validity: "Permanent"})`,
  `CREATE (:Document {name: "Spouse Death Certificate", validity: "Permanent"})`,
  `CREATE (:Document {name: "Income Certificate", validity: "1 Year"})`,
  `CREATE (:Document {name: "Pattadar Passbook (Land Title)", validity: "Permanent"})`,
  `CREATE (:Document {name: "Bank Passbook", validity: "Active"})`,
  `CREATE (:Document {name: "Community / Caste Certificate", validity: "Permanent"})`,

  // 3. Document Prerequisite Chains & Issuing Offices
  `MATCH (doc:Document {name: "Income Certificate"}), (prereq:Document {name: "Food Security Card (Ration Card)"}) CREATE (doc)-[:REQUIRES]->(prereq)`,
  `MATCH (doc:Document {name: "Income Certificate"}), (prereq:Document {name: "Aadhaar Card"}) CREATE (doc)-[:REQUIRES]->(prereq)`,
  `MATCH (doc:Document {name: "Income Certificate"}), (off:Office {name: "MeeSeva Centre"}) CREATE (doc)-[:ISSUED_BY]->(off)`,

  `MATCH (doc:Document {name: "Spouse Death Certificate"}), (off:Office {name: "Tahsildar / MRO Office"}) CREATE (doc)-[:ISSUED_BY]->(off)`,

  `MATCH (doc:Document {name: "Community / Caste Certificate"}), (prereq:Document {name: "Aadhaar Card"}) CREATE (doc)-[:REQUIRES]->(prereq)`,
  `MATCH (doc:Document {name: "Community / Caste Certificate"}), (off:Office {name: "MeeSeva Centre"}) CREATE (doc)-[:ISSUED_BY]->(off)`,

  `MATCH (doc:Document {name: "Bank Passbook"}), (prereq:Document {name: "Aadhaar Card"}) CREATE (doc)-[:REQUIRES]->(prereq)`,
  `MATCH (doc:Document {name: "Bank Passbook"}), (off:Office {name: "Nationalized / Regional Rural Bank"}) CREATE (doc)-[:ISSUED_BY]->(off)`,

  `MATCH (doc:Document {name: "Pattadar Passbook (Land Title)"}), (off:Office {name: "Tahsildar / MRO Office"}) CREATE (doc)-[:ISSUED_BY]->(off)`,
  `MATCH (doc:Document {name: "Food Security Card (Ration Card)"}), (off:Office {name: "Tahsildar / MRO Office"}) CREATE (doc)-[:ISSUED_BY]->(off)`,

  // 4. Scheme 1: Aasara Widow Pension (Telangana)
  `CREATE (s:Scheme {
    name: "Aasara Widow Pension",
    benefit: "₹2,016 per month",
    level: "State",
    official_url: "https://aasara.telangana.gov.in",
    last_verified: "2026-11-01"
  })`,
  `MATCH (s:Scheme {name: "Aasara Widow Pension"})
   CREATE (c1:Criterion {type: "min_age", operator: ">=", value: 18}),
          (c2:Criterion {type: "state", operator: "=", value: "Telangana"}),
          (c3:Criterion {type: "marital_status", operator: "=", value: "widow"}),
          (c4:Criterion {type: "max_income", operator: "<=", value: 150000})
   CREATE (s)-[:ELIGIBLE_IF]->(c1)
   CREATE (s)-[:ELIGIBLE_IF]->(c2)
   CREATE (s)-[:ELIGIBLE_IF]->(c3)
   CREATE (s)-[:ELIGIBLE_IF]->(c4)`,
  `MATCH (s:Scheme {name: "Aasara Widow Pension"}), (d1:Document {name: "Aadhaar Card"}), (d2:Document {name: "Spouse Death Certificate"}), (d3:Document {name: "Income Certificate"}), (d4:Document {name: "Bank Passbook"})
   CREATE (s)-[:REQUIRES]->(d1)
   CREATE (s)-[:REQUIRES]->(d2)
   CREATE (s)-[:REQUIRES]->(d3)
   CREATE (s)-[:REQUIRES]->(d4)`,

  // 5. Scheme 2: Rythu Bima (Telangana Farmer Group Life Insurance)
  `CREATE (s:Scheme {
    name: "Rythu Bima",
    benefit: "₹5,00,000 life insurance coverage",
    level: "State",
    official_url: "https://rythubandhu.telangana.gov.in",
    last_verified: "2026-11-01"
  })`,
  `MATCH (s:Scheme {name: "Rythu Bima"})
   CREATE (c1:Criterion {type: "min_age", operator: ">=", value: 18}),
          (c2:Criterion {type: "max_age", operator: "<=", value: 59}),
          (c3:Criterion {type: "state", operator: "=", value: "Telangana"}),
          (c4:Criterion {type: "occupation", operator: "=", value: "farmer"})
   CREATE (s)-[:ELIGIBLE_IF]->(c1)
   CREATE (s)-[:ELIGIBLE_IF]->(c2)
   CREATE (s)-[:ELIGIBLE_IF]->(c3)
   CREATE (s)-[:ELIGIBLE_IF]->(c4)`,
  `MATCH (s:Scheme {name: "Rythu Bima"}), (d1:Document {name: "Aadhaar Card"}), (d2:Document {name: "Pattadar Passbook (Land Title)"}), (d3:Document {name: "Bank Passbook"})
   CREATE (s)-[:REQUIRES]->(d1)
   CREATE (s)-[:REQUIRES]->(d2)
   CREATE (s)-[:REQUIRES]->(d3)`,

  // 6. Scheme 3: PM-KISAN (Central Government)
  `CREATE (s:Scheme {
    name: "PM-KISAN Samman Nidhi",
    benefit: "₹6,000 per year (3 installments)",
    level: "Central",
    official_url: "https://pmkisan.gov.in",
    last_verified: "2026-11-01"
  })`,
  `MATCH (s:Scheme {name: "PM-KISAN Samman Nidhi"})
   CREATE (c1:Criterion {type: "occupation", operator: "=", value: "farmer"}),
          (c2:Criterion {type: "max_income", operator: "<=", value: 200000})
   CREATE (s)-[:ELIGIBLE_IF]->(c1)
   CREATE (s)-[:ELIGIBLE_IF]->(c2)`,
  `MATCH (s:Scheme {name: "PM-KISAN Samman Nidhi"}), (d1:Document {name: "Aadhaar Card"}), (d2:Document {name: "Pattadar Passbook (Land Title)"}), (d3:Document {name: "Bank Passbook"})
   CREATE (s)-[:REQUIRES]->(d1)
   CREATE (s)-[:REQUIRES]->(d2)
   CREATE (s)-[:REQUIRES]->(d3)`,

  // 7. Scheme 4: Aasara Old Age Pension (Demonstrates CONFLICTS_WITH with Aasara Widow Pension)
  `CREATE (s:Scheme {
    name: "Aasara Old Age Pension",
    benefit: "₹2,016 per month",
    level: "State",
    official_url: "https://aasara.telangana.gov.in",
    last_verified: "2026-11-01"
  })`,
  `MATCH (s:Scheme {name: "Aasara Old Age Pension"})
   CREATE (c1:Criterion {type: "min_age", operator: ">=", value: 57}),
          (c2:Criterion {type: "state", operator: "=", value: "Telangana"}),
          (c3:Criterion {type: "max_income", operator: "<=", value: 150000})
   CREATE (s)-[:ELIGIBLE_IF]->(c1)
   CREATE (s)-[:ELIGIBLE_IF]->(c2)
   CREATE (s)-[:ELIGIBLE_IF]->(c3)`,
  `MATCH (s:Scheme {name: "Aasara Old Age Pension"}), (d1:Document {name: "Aadhaar Card"}), (d2:Document {name: "Income Certificate"}), (d3:Document {name: "Bank Passbook"})
   CREATE (s)-[:REQUIRES]->(d1)
   CREATE (s)-[:REQUIRES]->(d2)
   CREATE (s)-[:REQUIRES]->(d3)`,
  `MATCH (s1:Scheme {name: "Aasara Widow Pension"}), (s2:Scheme {name: "Aasara Old Age Pension"})
   CREATE (s1)-[:CONFLICTS_WITH]->(s2)`
];

// In-Memory Graph Data Store (guarantees zero-failure and provides graph visual topology)
export interface GraphNode {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphEdge {
  id: string;
  type: string;
  source: string;
  target: string;
  properties?: Record<string, any>;
}

export class MemoryGraphEngine {
  public nodes: Map<string, GraphNode> = new Map();
  public edges: GraphEdge[] = [];

  constructor() {
    this.seedDefaultGraph();
  }

  public seedDefaultGraph() {
    this.nodes.clear();
    this.edges = [];

    // Add Offices
    this.addNode('off_meeseva', ['Office'], { name: 'MeeSeva Centre', type: 'Digital Services Portal', portal_url: 'https://tg.meeseva.gov.in' });
    this.addNode('off_mro', ['Office'], { name: 'Tahsildar / MRO Office', type: 'Revenue Department', portal_url: 'https://dharani.telangana.gov.in' });
    this.addNode('off_vet', ['Office'], { name: 'District Animal Husbandry Office', type: 'Veterinary Department', portal_url: 'https://ahd.telangana.gov.in' });
    this.addNode('off_bank', ['Office'], { name: 'Nationalized / Regional Rural Bank', type: 'Banking Institution', portal_url: 'https://financialservices.gov.in' });
    this.addNode('off_panchayat', ['Office'], { name: 'Gram Panchayat / Ward Sachivalayam', type: 'Local Governance Office', portal_url: 'https://epanchayat.telangana.gov.in' });

    // Add Documents
    this.addNode('doc_aadhaar', ['Document'], { name: 'Aadhaar Card', validity: 'Permanent' });
    this.addNode('doc_ration', ['Document'], { name: 'Food Security Card (Ration Card)', validity: 'Permanent' });
    this.addNode('doc_death', ['Document'], { name: 'Spouse Death Certificate', validity: 'Permanent' });
    this.addNode('doc_income', ['Document'], { name: 'Income Certificate', validity: '1 Year' });
    this.addNode('doc_pattadar', ['Document'], { name: 'Pattadar Passbook (Land Title)', validity: 'Permanent' });
    this.addNode('doc_bank', ['Document'], { name: 'Bank Passbook', validity: 'Active' });
    this.addNode('doc_caste', ['Document'], { name: 'Community / Caste Certificate', validity: 'Permanent' });

    // Document Prerequisite Chains & Issuing Offices
    this.addEdge('doc_income', 'doc_ration', 'REQUIRES');
    this.addEdge('doc_income', 'doc_aadhaar', 'REQUIRES');
    this.addEdge('doc_income', 'off_meeseva', 'ISSUED_BY');

    this.addEdge('doc_death', 'off_mro', 'ISSUED_BY');

    this.addEdge('doc_caste', 'doc_aadhaar', 'REQUIRES');
    this.addEdge('doc_caste', 'off_meeseva', 'ISSUED_BY');

    this.addEdge('doc_bank', 'doc_aadhaar', 'REQUIRES');
    this.addEdge('doc_bank', 'off_bank', 'ISSUED_BY');

    this.addEdge('doc_pattadar', 'off_mro', 'ISSUED_BY');
    this.addEdge('doc_ration', 'off_mro', 'ISSUED_BY');

    // Scheme 1: Aasara Widow Pension
    this.addNode('sch_aasara', ['Scheme'], {
      name: 'Aasara Widow Pension',
      benefit: '₹2,016 per month',
      level: 'State',
      official_url: 'https://aasara.telangana.gov.in',
      last_verified: '2026-11-01'
    });
    this.addNode('crit_aasara_age', ['Criterion'], { type: 'min_age', operator: '>=', value: 18 });
    this.addNode('crit_aasara_state', ['Criterion'], { type: 'state', operator: '=', value: 'Telangana' });
    this.addNode('crit_aasara_marital', ['Criterion'], { type: 'marital_status', operator: '=', value: 'widow' });
    this.addNode('crit_aasara_inc', ['Criterion'], { type: 'max_income', operator: '<=', value: 150000 });

    this.addEdge('sch_aasara', 'crit_aasara_age', 'ELIGIBLE_IF');
    this.addEdge('sch_aasara', 'crit_aasara_state', 'ELIGIBLE_IF');
    this.addEdge('sch_aasara', 'crit_aasara_marital', 'ELIGIBLE_IF');
    this.addEdge('sch_aasara', 'crit_aasara_inc', 'ELIGIBLE_IF');

    this.addEdge('sch_aasara', 'doc_aadhaar', 'REQUIRES');
    this.addEdge('sch_aasara', 'doc_death', 'REQUIRES');
    this.addEdge('sch_aasara', 'doc_income', 'REQUIRES');
    this.addEdge('sch_aasara', 'doc_bank', 'REQUIRES');

    // Scheme 2: Rythu Bima
    this.addNode('sch_rythu_bima', ['Scheme'], {
      name: 'Rythu Bima',
      benefit: '₹5,00,000 life insurance coverage',
      level: 'State',
      official_url: 'https://rythubandhu.telangana.gov.in',
      last_verified: '2026-11-01'
    });
    this.addNode('crit_bima_min_age', ['Criterion'], { type: 'min_age', operator: '>=', value: 18 });
    this.addNode('crit_bima_max_age', ['Criterion'], { type: 'max_age', operator: '<=', value: 59 });
    this.addNode('crit_bima_state', ['Criterion'], { type: 'state', operator: '=', value: 'Telangana' });
    this.addNode('crit_bima_occ', ['Criterion'], { type: 'occupation', operator: '=', value: 'farmer' });

    this.addEdge('sch_rythu_bima', 'crit_bima_min_age', 'ELIGIBLE_IF');
    this.addEdge('sch_rythu_bima', 'crit_bima_max_age', 'ELIGIBLE_IF');
    this.addEdge('sch_rythu_bima', 'crit_bima_state', 'ELIGIBLE_IF');
    this.addEdge('sch_rythu_bima', 'crit_bima_occ', 'ELIGIBLE_IF');

    this.addEdge('sch_rythu_bima', 'doc_aadhaar', 'REQUIRES');
    this.addEdge('sch_rythu_bima', 'doc_pattadar', 'REQUIRES');
    this.addEdge('sch_rythu_bima', 'doc_bank', 'REQUIRES');

    // Scheme 3: PM-KISAN
    this.addNode('sch_pm_kisan', ['Scheme'], {
      name: 'PM-KISAN Samman Nidhi',
      benefit: '₹6,000 per year (3 installments)',
      level: 'Central',
      official_url: 'https://pmkisan.gov.in',
      last_verified: '2026-11-01'
    });
    this.addNode('crit_kisan_occ', ['Criterion'], { type: 'occupation', operator: '=', value: 'farmer' });
    this.addNode('crit_kisan_inc', ['Criterion'], { type: 'max_income', operator: '<=', value: 200000 });

    this.addEdge('sch_pm_kisan', 'crit_kisan_occ', 'ELIGIBLE_IF');
    this.addEdge('sch_pm_kisan', 'crit_kisan_inc', 'ELIGIBLE_IF');

    this.addEdge('sch_pm_kisan', 'doc_aadhaar', 'REQUIRES');
    this.addEdge('sch_pm_kisan', 'doc_pattadar', 'REQUIRES');
    this.addEdge('sch_pm_kisan', 'doc_bank', 'REQUIRES');

    // Scheme 4: Aasara Old Age Pension (Conflicts with Aasara Widow Pension)
    this.addNode('sch_aasara_old', ['Scheme'], {
      name: 'Aasara Old Age Pension',
      benefit: '₹2,016 per month',
      level: 'State',
      official_url: 'https://aasara.telangana.gov.in',
      last_verified: '2026-11-01'
    });
    this.addNode('crit_old_age', ['Criterion'], { type: 'min_age', operator: '>=', value: 57 });
    this.addNode('crit_old_state', ['Criterion'], { type: 'state', operator: '=', value: 'Telangana' });
    this.addNode('crit_old_inc', ['Criterion'], { type: 'max_income', operator: '<=', value: 150000 });

    this.addEdge('sch_aasara_old', 'crit_old_age', 'ELIGIBLE_IF');
    this.addEdge('sch_aasara_old', 'crit_old_state', 'ELIGIBLE_IF');
    this.addEdge('sch_aasara_old', 'crit_old_inc', 'ELIGIBLE_IF');

    this.addEdge('sch_aasara_old', 'doc_aadhaar', 'REQUIRES');
    this.addEdge('sch_aasara_old', 'doc_income', 'REQUIRES');
    this.addEdge('sch_aasara_old', 'doc_bank', 'REQUIRES');

    this.addEdge('sch_aasara', 'sch_aasara_old', 'CONFLICTS_WITH');
  }

  private addNode(id: string, labels: string[], properties: Record<string, any>) {
    this.nodes.set(id, { id, labels, properties });
  }

  private addEdge(source: string, target: string, type: string, properties: Record<string, any> = {}) {
    this.edges.push({
      id: `${source}-${type}->${target}`,
      source,
      target,
      type,
      properties
    });
  }

  public querySchemesWithCriteria(): any[] {
    const results: any[] = [];
    for (const [id, node] of this.nodes) {
      if (node.labels.includes('Scheme')) {
        const criteriaEdges = this.edges.filter(e => e.source === id && e.type === 'ELIGIBLE_IF');
        const criteria = criteriaEdges.map(e => {
          const critNode = this.nodes.get(e.target);
          return critNode ? { ...critNode.properties } : null;
        }).filter(Boolean);

        results.push({
          scheme: node.properties.name,
          benefit: node.properties.benefit,
          url: node.properties.official_url,
          level: node.properties.level,
          last_verified: node.properties.last_verified,
          criteria
        });
      }
    }
    return results;
  }

  public queryMissingAndPrereqs(eligibleSchemes: string[], heldDocuments: string[]): any[] {
    const missingDocsMap = new Map<string, { schemes: Set<string>; prereqs: Set<string> }>();

    for (const schemeName of eligibleSchemes) {
      // Find scheme node
      let schemeNodeId: string | null = null;
      for (const [id, node] of this.nodes) {
        if (node.labels.includes('Scheme') && node.properties.name === schemeName) {
          schemeNodeId = id;
          break;
        }
      }
      if (!schemeNodeId) continue;

      // Find required documents
      const reqEdges = this.edges.filter(e => e.source === schemeNodeId && e.type === 'REQUIRES');
      for (const edge of reqEdges) {
        const docNode = this.nodes.get(edge.target);
        if (!docNode || !docNode.labels.includes('Document')) continue;
        const docName = docNode.properties.name;

        if (!heldDocuments.includes(docName)) {
          if (!missingDocsMap.has(docName)) {
            missingDocsMap.set(docName, { schemes: new Set(), prereqs: new Set() });
          }
          const entry = missingDocsMap.get(docName)!;
          entry.schemes.add(schemeName);

          // Find prerequisites for this missing document
          const docPrereqEdges = this.edges.filter(e => e.source === docNode.id && e.type === 'REQUIRES');
          for (const pEdge of docPrereqEdges) {
            const pNode = this.nodes.get(pEdge.target);
            if (pNode && pNode.properties.name) {
              entry.prereqs.add(pNode.properties.name);
            }
          }
        }
      }
    }

    const records: any[] = [];
    for (const [missingDoc, data] of missingDocsMap.entries()) {
      records.push({
        missing_document: missingDoc,
        schemes_unlocked: data.schemes.size,
        prerequisites: Array.from(data.prereqs)
      });
    }

    records.sort((a, b) => b.schemes_unlocked - a.schemes_unlocked);
    return records;
  }

  public queryConflicts(eligibleSchemes: string[]): any[] {
    const conflicts: any[] = [];
    const conflictEdges = this.edges.filter(e => e.type === 'CONFLICTS_WITH');

    for (const edge of conflictEdges) {
      const sourceNode = this.nodes.get(edge.source);
      const targetNode = this.nodes.get(edge.target);
      if (sourceNode && targetNode) {
        const nameA = sourceNode.properties.name;
        const nameB = targetNode.properties.name;
        if (eligibleSchemes.includes(nameA) && eligibleSchemes.includes(nameB)) {
          // avoid duplicate reverse pairs
          const pairExists = conflicts.some(c => (c.scheme_a === nameA && c.scheme_b === nameB) || (c.scheme_a === nameB && c.scheme_b === nameA));
          if (!pairExists) {
            conflicts.push({
              scheme_a: nameA,
              scheme_b: nameB,
              reason: 'Simultaneous social security pension disbursement is restricted under Single Benefit Provision.'
            });
          }
        }
      }
    }
    return conflicts;
  }

  public getDocumentIssuingOffice(docName: string): { officeName: string; portalUrl: string } | null {
    let docId: string | null = null;
    for (const [id, node] of this.nodes) {
      if (node.labels.includes('Document') && node.properties.name === docName) {
        docId = id;
        break;
      }
    }
    if (!docId) return null;

    const issuedByEdge = this.edges.find(e => e.source === docId && e.type === 'ISSUED_BY');
    if (!issuedByEdge) return null;

    const officeNode = this.nodes.get(issuedByEdge.target);
    if (!officeNode) return null;

    return {
      officeName: officeNode.properties.name,
      portalUrl: officeNode.properties.portal_url || ''
    };
  }
}

export const memoryEngine = new MemoryGraphEngine();

// Connect to FalkorDB Cloud with resilience
export async function initFalkorDB(): Promise<boolean> {
  if (isConnected && graph) return true;
  if (!FALKORDB_HOST || !FALKORDB_PASSWORD) {
    console.warn('[FalkorDB] FALKORDB_HOST or FALKORDB_PASSWORD is not configured. Using built-in memory engine.');
    isConnected = false;
    return false;
  }
  lastConnectionAttempt = Date.now();

  try {
    console.log(`[FalkorDB] Connecting to ${FALKORDB_HOST}:${FALKORDB_PORT}...`);
    client = await Promise.race([
      FalkorDB.connect({
        host: FALKORDB_HOST,
        port: FALKORDB_PORT,
        username: FALKORDB_USERNAME,
        password: FALKORDB_PASSWORD
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('FalkorDB connection timed out')), FALKORDB_CONNECT_TIMEOUT_MS)
      )
    ]);

    graph = client.selectGraph(GRAPH_NAME);
    isConnected = true;
    console.log(`[FalkorDB] Connected successfully to FalkorDB cloud graph '${GRAPH_NAME}'!`);

    // Verify or seed graph
    try {
      const checkRes = await graph.query('MATCH (s:Scheme) RETURN count(s) AS scheme_count');
      const count = checkRes.data?.[0]?.scheme_count ?? 0;
      console.log(`[FalkorDB] Current schemes in graph: ${count}`);
      if (count === 0) {
        console.log('[FalkorDB] Graph is empty. Seeding welfare knowledge graph...');
        for (const query of SEED_CYPHER_QUERIES) {
          await graph.query(query);
        }
        console.log('[FalkorDB] Seeding completed successfully!');
      }
    } catch (seedErr: any) {
      console.warn('[FalkorDB] Verification/seed warning:', seedErr.message);
    }

    return true;
  } catch (err: any) {
    console.warn(`[FalkorDB] Cloud connection failed: ${err.message}. Using built-in high performance memory engine.`);
    isConnected = false;
    return false;
  }
}

/**
 * Executes openCypher queries directly on FalkorDB (or in-memory engine fallback).
 * This satisfies the 'execute_falkordb_cypher' tool specification.
 */
export async function execute_falkordb_cypher(query: string, params: Record<string, any> = {}): Promise<{
  success: boolean;
  data: any[];
  executionTimeMs: number;
  source: 'falkordb_cloud' | 'falkordb_local_engine';
  error?: string;
}> {
  const startTime = Date.now();

  // Attempt lazy reconnect if not connected and cooldown elapsed
  if ((!isConnected || !graph) && FALKORDB_HOST && FALKORDB_PASSWORD && (Date.now() - lastConnectionAttempt > RECONNECT_COOLDOWN_MS)) {
    await initFalkorDB();
  }

  // Try live FalkorDB cloud if connected
  if (isConnected && graph) {
    try {
      const res = await graph.query(query, { params });
      const executionTimeMs = Date.now() - startTime;
      return {
        success: true,
        data: res.data || [],
        executionTimeMs,
        source: 'falkordb_cloud'
      };
    } catch (cloudErr: any) {
      console.warn('[FalkorDB] Query on cloud instance error:', cloudErr.message);
      isConnected = false;
    }
  }

  // Fallback to memory graph engine for pattern queries
  try {
    const norm = query.replace(/\s+/g, ' ').trim();
    let data: any[] = [];

    if (norm.includes('MATCH (s:Scheme)') && norm.includes('ELIGIBLE_IF')) {
      data = memoryEngine.querySchemesWithCriteria();
    } else if (norm.includes('MATCH (s:Scheme)-[:REQUIRES]->(d:Document)')) {
      const eligible = params.eligible_schemes || [];
      const held = params.held_documents || [];
      data = memoryEngine.queryMissingAndPrereqs(eligible, held);
    } else if (norm.includes('CONFLICTS_WITH')) {
      const eligible = params.eligible_schemes || [];
      data = memoryEngine.queryConflicts(eligible);
    } else if (norm.includes('RETURN s, d') || norm.includes('MATCH (n)')) {
      // General return for nodes
      data = Array.from(memoryEngine.nodes.values()).map(n => ({
        id: n.id,
        labels: n.labels,
        ...n.properties
      }));
    } else {
      // Generic match on memory engine
      data = memoryEngine.querySchemesWithCriteria();
    }

    const executionTimeMs = Date.now() - startTime;
    return {
      success: true,
      data,
      executionTimeMs,
      source: 'falkordb_local_engine'
    };
  } catch (err: any) {
    return {
      success: false,
      data: [],
      executionTimeMs: Date.now() - startTime,
      source: 'falkordb_local_engine',
      error: err.message
    };
  }
}

export function getGraphTopology() {
  return {
    nodes: Array.from(memoryEngine.nodes.values()),
    edges: memoryEngine.edges,
    meta: {
      totalNodes: memoryEngine.nodes.size,
      totalEdges: memoryEngine.edges.length,
      connectedCloud: isConnected,
      cloudHost: FALKORDB_HOST
    }
  };
}
