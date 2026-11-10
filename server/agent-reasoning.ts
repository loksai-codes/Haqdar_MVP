import { execute_falkordb_cypher, memoryEngine } from './falkordb-service.ts';

export interface CitizenProfile {
  id?: string;
  state: string;
  age: number;
  gender: 'female' | 'male' | 'other' | string;
  marital_status: 'single' | 'married' | 'widow' | 'divorced' | string;
  occupation: string;
  annual_income: number;
  held_documents: string[];
  preferred_language?: 'en' | 'te' | 'hi';
}

export interface SchemeResult {
  name: string;
  benefit: string;
  official_url: string;
  level?: string;
}

export interface TopUnlockDocument {
  name: string;
  unlocks_count: number;
  issued_by: string;
  portal_url?: string;
  prerequisites?: string[];
}

export interface ActionStep {
  step: number;
  task: string;
  office: string;
  portal_url?: string;
  requires: string[];
  timeline?: string;
  status?: 'pending' | 'ready';
}

export interface SchemeConflict {
  scheme_a: string;
  scheme_b: string;
  reason?: string;
}

export interface ReasoningExecutionTrace {
  query: string;
  params: Record<string, any>;
  executionTimeMs: number;
  source: string;
  recordsCount: number;
  stepDescription: string;
}

export interface HaqdarReasoningResponse {
  profile_summary: string;
  eligible_schemes: SchemeResult[];
  top_unlock_document: TopUnlockDocument | null;
  action_roadmap: ActionStep[];
  conflicts_detected: SchemeConflict[];
  whatsapp_message: string;
  highlight_nodes: string[];
  disclaimer: string;
  execution_traces: ReasoningExecutionTrace[];
}

/**
 * Checks if a citizen profile satisfies a single criterion node.
 */
function evaluateCriterion(profile: CitizenProfile, criterion: Record<string, any>): { satisfied: boolean; reason: string } {
  const { type, operator, value } = criterion;

  switch (type) {
    case 'min_age': {
      const target = Number(value);
      const passed = profile.age >= target;
      return { satisfied: passed, reason: `Age ${profile.age} ${passed ? '>=' : '<'} required minimum ${target}` };
    }
    case 'max_age': {
      const target = Number(value);
      const passed = profile.age <= target;
      return { satisfied: passed, reason: `Age ${profile.age} ${passed ? '<=' : '>'} allowed maximum ${target}` };
    }
    case 'state': {
      const passed = profile.state.trim().toLowerCase() === String(value).trim().toLowerCase();
      return { satisfied: passed, reason: `State '${profile.state}' ${passed ? 'matches' : 'does not match'} required '${value}'` };
    }
    case 'marital_status': {
      const passed = profile.marital_status.trim().toLowerCase() === String(value).trim().toLowerCase();
      return { satisfied: passed, reason: `Marital status '${profile.marital_status}' ${passed ? 'matches' : 'does not match'} '${value}'` };
    }
    case 'max_income': {
      const target = Number(value);
      const passed = profile.annual_income <= target;
      return { satisfied: passed, reason: `Income ₹${profile.annual_income.toLocaleString('en-IN')} ${passed ? '<=' : '>'} ceiling ₹${target.toLocaleString('en-IN')}` };
    }
    case 'occupation': {
      const occ = profile.occupation.trim().toLowerCase();
      const target = String(value).trim().toLowerCase();
      const passed = occ.includes(target) || target.includes(occ);
      return { satisfied: passed, reason: `Occupation '${profile.occupation}' ${passed ? 'qualifies for' : 'does not match'} '${value}'` };
    }
    default:
      return { satisfied: true, reason: `Unknown criterion type '${type}' default allowed` };
  }
}

/**
 * Core Graph Reasoning Engine:
 * Follows the Hackathon Brief workflow strictly grounded in FalkorDB queries.
 */
export async function performHaqdarReasoning(profile: CitizenProfile): Promise<HaqdarReasoningResponse> {
  const traces: ReasoningExecutionTrace[] = [];

  // ==========================================
  // STEP 1: Execute openCypher Query 1 to match eligible schemes
  // ==========================================
  const query1 = `MATCH (s:Scheme) OPTIONAL MATCH (s)-[:ELIGIBLE_IF]->(c:Criterion) RETURN s.name AS scheme, s.benefit AS benefit, s.official_url AS url, collect(properties(c)) AS criteria`;
  const res1 = await execute_falkordb_cypher(query1);

  traces.push({
    query: query1,
    params: {},
    executionTimeMs: res1.executionTimeMs,
    source: res1.source,
    recordsCount: res1.data.length,
    stepDescription: 'Query 1: Evaluated all schemes and eligibility criteria rules from graph'
  });

  const eligibleSchemes: SchemeResult[] = [];
  const eligibleSchemeNames: string[] = [];

  for (const row of res1.data) {
    const schemeName = row.scheme;
    const benefit = row.benefit;
    const url = row.url;
    const criteriaList = row.criteria || [];

    // Grounded criterion verification
    let allSatisfied = true;
    for (const crit of criteriaList) {
      if (!crit || Object.keys(crit).length === 0) continue;
      const evaluation = evaluateCriterion(profile, crit);
      if (!evaluation.satisfied) {
        allSatisfied = false;
        break;
      }
    }

    if (allSatisfied) {
      eligibleSchemes.push({
        name: schemeName,
        benefit: benefit || 'Government statutory welfare benefit',
        official_url: url || '#'
      });
      eligibleSchemeNames.push(schemeName);
    }
  }

  // ==========================================
  // STEP 2: Execute openCypher Query 2 to find prerequisite documents & top unlock document
  // ==========================================
  const query2 = `MATCH (s:Scheme)-[:REQUIRES]->(d:Document) WHERE s.name IN $eligible_schemes AND NOT d.name IN $held_documents OPTIONAL MATCH (d)-[:REQUIRES]->(prereq:Document) RETURN d.name AS missing_document, count(DISTINCT s) AS schemes_unlocked, collect(DISTINCT prereq.name) AS prerequisites ORDER BY schemes_unlocked DESC`;
  const params2 = {
    eligible_schemes: eligibleSchemeNames,
    held_documents: profile.held_documents || []
  };

  const res2 = await execute_falkordb_cypher(query2, params2);

  traces.push({
    query: query2,
    params: params2,
    executionTimeMs: res2.executionTimeMs,
    source: res2.source,
    recordsCount: res2.data.length,
    stepDescription: 'Query 2: Computed missing documents, unlock frequencies, and prerequisite chains'
  });

  let topUnlockDoc: TopUnlockDocument | null = null;
  const missingDocumentsList: any[] = res2.data || [];

  if (missingDocumentsList.length > 0) {
    const topItem = missingDocumentsList[0];
    const docName = topItem.missing_document;
    const officeInfo = memoryEngine.getDocumentIssuingOffice(docName);

    topUnlockDoc = {
      name: docName,
      unlocks_count: Number(topItem.schemes_unlocked) || 1,
      issued_by: officeInfo ? officeInfo.officeName : 'Competent Government Authority',
      portal_url: officeInfo?.portalUrl,
      prerequisites: topItem.prerequisites || []
    };
  }

  // ==========================================
  // STEP 3: Execute openCypher Query 3 to check for conflicts between eligible schemes
  // ==========================================
  const query3 = `MATCH (s1:Scheme)-[:CONFLICTS_WITH]-(s2:Scheme) WHERE s1.name IN $eligible_schemes AND s2.name IN $eligible_schemes AND id(s1) < id(s2) RETURN s1.name AS scheme_a, s2.name AS scheme_b`;
  const params3 = {
    eligible_schemes: eligibleSchemeNames
  };

  const res3 = await execute_falkordb_cypher(query3, params3);

  traces.push({
    query: query3,
    params: params3,
    executionTimeMs: res3.executionTimeMs,
    source: res3.source,
    recordsCount: res3.data.length,
    stepDescription: 'Query 3: Audited mutual exclusivity constraints and conflict edges between schemes'
  });

  const conflictsDetected: SchemeConflict[] = res3.data.map(item => ({
    scheme_a: item.scheme_a,
    scheme_b: item.scheme_b,
    reason: 'Under Single Benefit Rules, citizen cannot draw two simultaneous social security pensions.'
  }));

  // ==========================================
  // STEP 4: Build Action Roadmap (Action Agent)
  // ==========================================
  const actionRoadmap: ActionStep[] = [];
  let stepNumber = 1;

  // Identify root prerequisites that the citizen DOES NOT yet hold
  const rootPrereqsNeeded = new Set<string>();
  for (const item of missingDocumentsList) {
    for (const prereq of (item.prerequisites || [])) {
      if (!profile.held_documents.includes(prereq)) {
        rootPrereqsNeeded.add(prereq);
      }
    }
  }

  // Step 1: Root prerequisite documents
  if (rootPrereqsNeeded.size > 0) {
    for (const rootDoc of rootPrereqsNeeded) {
      const office = memoryEngine.getDocumentIssuingOffice(rootDoc);
      actionRoadmap.push({
        step: stepNumber++,
        task: `Acquire foundational document: '${rootDoc}'`,
        office: office ? office.officeName : 'Tahsildar / MRO Office',
        portal_url: office?.portalUrl,
        requires: ['Proof of Identity / Address'],
        timeline: '1-3 business days',
        status: 'pending'
      });
    }
  }

  // Step 2: Apply for high-impact unlock document
  if (topUnlockDoc) {
    actionRoadmap.push({
      step: stepNumber++,
      task: `Apply for Top Unlock Document: '${topUnlockDoc.name}' (Unlocks ${topUnlockDoc.unlocks_count} eligible schemes!)`,
      office: topUnlockDoc.issued_by,
      portal_url: topUnlockDoc.portal_url,
      requires: topUnlockDoc.prerequisites && topUnlockDoc.prerequisites.length > 0 ? topUnlockDoc.prerequisites : ['Aadhaar Card', 'Ration Card'],
      timeline: '3-7 business days',
      status: rootPrereqsNeeded.size === 0 ? 'ready' : 'pending'
    });
  }

  // Step 3: Other missing documents
  for (const item of missingDocumentsList.slice(1)) {
    const docName = item.missing_document;
    const office = memoryEngine.getDocumentIssuingOffice(docName);
    actionRoadmap.push({
      step: stepNumber++,
      task: `Apply for '${docName}' to unlock further entitlements`,
      office: office ? office.officeName : 'Concerned Department Office',
      portal_url: office?.portalUrl,
      requires: item.prerequisites && item.prerequisites.length > 0 ? item.prerequisites : ['Aadhaar Card'],
      timeline: '3-5 business days',
      status: 'pending'
    });
  }

  // Step 4: Final submission for unlocked schemes
  if (eligibleSchemes.length > 0) {
    for (const scheme of eligibleSchemes) {
      actionRoadmap.push({
        step: stepNumber++,
        task: `Submit application for '${scheme.name}' at government portal (${scheme.benefit})`,
        office: scheme.name.includes('Aasara') ? 'MeeSeva Centre / Panchayat Sachivalayam' : 'Agriculture Dept / PM-Kisan Nodal Branch',
        portal_url: scheme.official_url,
        requires: ['Complete Document Portfolio', 'Bank Passbook for DBT Linking'],
        timeline: 'Immediate upon documents completion',
        status: missingDocumentsList.length === 0 ? 'ready' : 'pending'
      });
    }
  } else {
    actionRoadmap.push({
      step: 1,
      task: 'Verify state and income criteria for alternate general welfare programs',
      office: 'Gram Panchayat / Citizen Service Centre',
      portal_url: 'https://tg.meeseva.gov.in',
      requires: ['Identity Proof'],
      timeline: 'Advisory consultation',
      status: 'ready'
    });
  }

  // ==========================================
  // STEP 5: Collect Highlight Nodes for Graph Visualizer
  // ==========================================
  const highlightNodes = new Set<string>();

  // Add eligible schemes
  for (const s of eligibleSchemes) {
    highlightNodes.add(s.name);
  }
  // Add missing documents
  for (const d of missingDocumentsList) {
    highlightNodes.add(d.missing_document);
  }
  // Add held documents
  for (const h of profile.held_documents) {
    highlightNodes.add(h);
  }
  // Add offices
  if (topUnlockDoc) {
    highlightNodes.add(topUnlockDoc.issued_by);
  }

  // ==========================================
  // STEP 6: Profile Summary & WhatsApp Message (Action Agent)
  // ==========================================
  const profileSummary = `${profile.age}y ${profile.gender}, ${profile.marital_status}, ${profile.occupation} in ${profile.state} (Annual Income: ₹${profile.annual_income.toLocaleString('en-IN')}, Holds: ${profile.held_documents.length} docs)`;

  const mandatoryDisclaimer = 'Haqdar provides navigation based on verified public schemes. Final determination is made by the competent government authority.';

  // Build WhatsApp text formatted cleanly with emojis and bullet points
  const waSchemeLines = eligibleSchemes.map((s, idx) => `${idx + 1}. *${s.name}*: ${s.benefit}\n   🔗 Official Portal: ${s.official_url}`).join('\n\n');

  const waRoadmapLines = actionRoadmap.slice(0, 4).map(step => `📍 *Step ${step.step}*: ${step.task}\n   🏛️ Visit: ${step.office}${step.portal_url ? ` (${step.portal_url})` : ''}`).join('\n');

  const waTopUnlockText = topUnlockDoc
    ? `🎯 *HIGHEST IMPACT DOCUMENT TO OBTAIN FIRST:*\n👉 *${topUnlockDoc.name}*\nUnlocks *${topUnlockDoc.unlocks_count} schemes* directly!\nIssuing Office: ${topUnlockDoc.issued_by}`
    : '✅ You currently hold all primary prerequisite documents!';

  const waConflictsText = conflictsDetected.length > 0
    ? `⚠️ *Scheme Conflict Notice:*\n${conflictsDetected.map(c => `• ${c.scheme_a} ↔ ${c.scheme_b}: Cannot be availed simultaneously under single-benefit rule`).join('\n')}\n`
    : '';

  const whatsappMessage = `*HAQDAR WELFARE BENEFIT REPORT* 🏛️🇮🇳
_AI Graph Welfare Navigator for Citizens_

👤 *Citizen Profile:*
${profileSummary}

🎁 *ELIGIBLE WELFARE SCHEMES (${eligibleSchemes.length}):*
${waSchemeLines || 'No matching state-specific schemes with current parameters.'}

${waTopUnlockText}

${waConflictsText}
📋 *RECOMMENDED ACTION ROADMAP:*
${waRoadmapLines}

🔒 *Privacy Assurance:* Haqdar does not store Aadhaar numbers or government identity tokens.

📌 *Statutory Note:*
${mandatoryDisclaimer}

_Generated via Haqdar Knowledge Graph Engine_`;

  return {
    profile_summary: profileSummary,
    eligible_schemes: eligibleSchemes,
    top_unlock_document: topUnlockDoc,
    action_roadmap: actionRoadmap,
    conflicts_detected: conflictsDetected,
    whatsapp_message: whatsappMessage,
    highlight_nodes: Array.from(highlightNodes),
    disclaimer: mandatoryDisclaimer,
    execution_traces: traces
  };
}
