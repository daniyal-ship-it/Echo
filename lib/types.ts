export const REGIONS = ['frontal', 'parietal', 'temporal', 'occipital'] as const;
export type Region = (typeof REGIONS)[number];
export const REGION_INFO: Record<
  Region,
  { name: string; color: string; meaning: string; index: number }
> = {
  frontal: { name: 'Frontal', color: '#5b9dff', meaning: 'Plans · decisions · goals', index: 1 },
  parietal: {
    name: 'Parietal',
    color: '#b396ff',
    meaning: 'Ideas · knowledge · connections',
    index: 2,
  },
  temporal: {
    name: 'Temporal',
    color: '#57d6d0',
    meaning: 'Conversations · lived experience',
    index: 3,
  },
  occipital: {
    name: 'Occipital',
    color: '#e7bc78',
    meaning: 'Visual references · creativity',
    index: 4,
  },
};
export type Memory = {
  id: string;
  title: string;
  summary: string;
  region: Region;
  source: string;
  kind: string;
  tags: string[];
  created_at: string;
  source_at: string | null;
  importance: number;
  position: [number, number, number];
  anchor: number;
  version: number;
  is_demo: boolean;
  indexing_status: string;
};
export type Message = {
  id: string;
  role: string;
  content: string;
  timestamp: string | null;
  parent: string | null;
  active: boolean;
  model?: string;
};
export type MemoryDetail = Memory & {
  viewed_version: number;
  content: string;
  raw: unknown;
  messages: Message[];
  versions: { version: number; created_at: string; fingerprint: string }[];
  edges: Edge[];
};
export type Edge = {
  id: string;
  source_id: string;
  target_id: string;
  relationship: string;
  evidence: string;
  confidence: number;
  strength: number;
  method: string;
  status: string;
  pinned: boolean;
  source_title?: string;
  target_title?: string;
};
export type GraphNode = {
  id: string;
  title: string;
  region: Region;
  position: [number, number, number];
  count: number;
  is_demo: boolean;
};
export type Graph = {
  nodes: GraphNode[];
  edges: Edge[];
  total: number;
  filteredTotal?: number;
  counts: Record<string, number>;
  aggregated: boolean;
};
export type Session = { userId: string; workspaceId: string; email: string; name: string };
export type ImportItem = {
  source: string;
  sourceId: string;
  title: string;
  content: string;
  raw: unknown;
  messages: Message[];
  sourceAt: string | null;
  kind: string;
  tags: string[];
  region?: Region;
};
export type Job = {
  id: string;
  filename: string;
  status: string;
  total: number;
  processed: number;
  added: number;
  duplicates: number;
  error: string | null;
  created_at: string;
};
export type Citation = {
  id: string;
  title: string;
  excerpt: string;
  source: string;
  region: Region;
  rank: number;
};
