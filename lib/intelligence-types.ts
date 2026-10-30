export const CHUNKER_VERSION = 'messages-utf16-v1';
export const PROMPT_VERSION = 'grounded-analysis-v1';
export const EMBEDDING_DIMENSIONS = 1536;
export const MAX_CHUNKS = 64;
export const INTELLIGENCE_BATCH = 8;
export type Passage = {
  id: string;
  workspace_id: string;
  memory_id: string;
  source_version: number;
  ordinal: number;
  message_id: string | null;
  message_index: number | null;
  role: string | null;
  source_timestamp: string | null;
  active: boolean;
  start_offset: number;
  end_offset: number;
  content: string;
  content_hash: string;
  chunker_version: string;
};
export type Evidence = { chunkId: string; quote: string };
export type Claim = { text: string; citations: Evidence[] };
export type Analysis = {
  summary: Claim[];
  insights: (Claim & { kind: 'decision' | 'question' | 'commitment' })[];
};
export type IntelligenceConfig = {
  embeddingModel: string;
  dimensions: number;
  summaryProvider: 'openai' | 'anthropic';
  summaryModel: string;
  promptVersion: string;
  chunkerVersion: string;
};
export type IntelligenceJob = {
  id: string;
  workspace_id: string;
  memory_id: string;
  source_version: number;
  source_hash: string;
  config: IntelligenceConfig;
  config_hash: string;
  status:
    | 'queued'
    | 'running'
    | 'retry_wait'
    | 'uncertain'
    | 'failed'
    | 'cancelled'
    | 'completed'
    | 'superseded';
  total_chunks: number;
  embedded: number;
  analysed: number;
  lease_token: string | null;
  lease_until: string | null;
  next_attempt_at: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
};
export type GeneratedAnalysis = {
  id: string;
  source_version: number;
  provider: string;
  model: string;
  prompt_version: string;
  result: Analysis;
  created_at: string;
};
