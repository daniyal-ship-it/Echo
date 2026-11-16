import { z } from 'zod';
import type { Citation } from './types';
import type { ModelOutput, Provider } from './providers';

export const COLLABORATION_VERSION = 'echo-collaboration-v1';
export const COLLABORATION_PROMPT = 'grounded-collaboration-v1';
export const idempotencyKey = z
  .string()
  .min(8)
  .max(120)
  .regex(/^[\w-]+$/);
const modelId = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:-]+$/);
export const turnInput = z
  .object({
    version: z.literal(COLLABORATION_VERSION),
    idempotencyKey,
    question: z.string().trim().min(2).max(2000),
    mode: z.enum(['parallel', 'deliberate']),
    models: z.object({ openai: modelId, anthropic: modelId }).strict(),
    consent: z.literal(true),
    filters: z
      .object({
        region: z.string().max(20).optional(),
        source: z.string().max(40).optional(),
        tag: z.string().max(80).optional(),
        from: z.string().max(10).optional(),
        to: z.string().max(10).optional(),
        q: z.string().max(500).optional(),
        untagged: z.string().max(1).optional(),
      })
      .strict()
      .optional(),
    limits: z
      .object({
        maxCalls: z.number().int().min(2).max(8),
        maxOutputTokens: z.number().int().min(128).max(2048),
        maxInputBytes: z.number().int().min(4000).max(48000),
      })
      .strict(),
  })
  .strict()
  .refine((v) => v.limits.maxCalls >= (v.mode === 'deliberate' ? 5 : 2), {
    message: 'The call limit must cover the selected mode.',
  });
export const advanceInput = z
  .object({
    version: z.literal(COLLABORATION_VERSION),
    turnId: z.uuid(),
    idempotencyKey,
    retry: z.boolean().default(false),
    acknowledgePossibleDuplicateCharge: z.boolean().default(false),
  })
  .strict();
export type TurnInput = z.infer<typeof turnInput>;
export type AdvanceInput = z.infer<typeof advanceInput>;
export type CollaborationStatus =
  'queued' | 'running' | 'awaiting-next-step' | 'completed' | 'failed' | 'cancelled' | 'uncertain';
export type CollaborationStage = 'analysis' | 'review' | 'synthesis';
const text = z.string().trim().min(1).max(1600);
export const reasoningSchema = z
  .object({
    groundedClaims: z
      .array(
        z
          .object({
            text,
            citations: z
              .array(z.object({ source: z.number().int().positive(), quote: text }).strict())
              .min(1)
              .max(6),
          })
          .strict(),
      )
      .max(8),
    interpretations: z.array(text).max(8),
    agreements: z.array(text).max(8),
    disagreements: z.array(text).max(8),
    uncertainty: z.array(text).min(1).max(8),
  })
  .strict();
export type Reasoning = z.infer<typeof reasoningSchema>;
export type HistoryEntry = {
  turnId: string;
  question: string;
  discussion: string;
  citations: Citation[];
};
export type CollaborationTurn = {
  id: string;
  thread_id: string;
  workspace_id: string;
  ordinal: number;
  request_hash: string;
  question: string;
  mode: TurnInput['mode'];
  config: TurnInput;
  citations: Citation[];
  history: HistoryEntry[];
  prompt_version: string;
  status: CollaborationStatus;
  stage: CollaborationStage;
  error: string | null;
  lease_token: string | null;
  lease_until: string | null;
  consent_at: string;
  created_at: string;
  updated_at: string;
};
export type CollaborationCall = {
  id: string;
  workspace_id: string;
  turn_id: string;
  stage: CollaborationStage;
  provider: Provider;
  model: string;
  attempt: number;
  status: 'planned' | 'dispatched' | 'completed' | 'failed' | 'uncertain' | 'withheld';
  billing: 'not-sent' | 'unknown' | 'reported' | 'rejected';
  output: ModelOutput | null;
  result: Reasoning | null;
  error: string | null;
  retryable: boolean;
  created_at: string;
  finished_at: string | null;
};
