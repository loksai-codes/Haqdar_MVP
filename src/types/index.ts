export type Language = 'en' | 'te' | 'hi';

export interface CitizenProfile {
  id?: string;
  state: string;
  age: number;
  gender: 'female' | 'male' | 'other' | string;
  marital_status: 'single' | 'married' | 'widow' | 'divorced' | string;
  occupation: string;
  annual_income: number;
  held_documents: string[];
  preferred_language?: Language;
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

export interface GraphNodeData {
  id: string;
  labels: string[];
  properties: Record<string, any>;
}

export interface GraphEdgeData {
  id: string;
  type: string;
  source: string;
  target: string;
  properties?: Record<string, any>;
}

export interface GraphTopology {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  meta: {
    totalNodes: number;
    totalEdges: number;
    connectedCloud: boolean;
    cloudHost: string;
  };
}
