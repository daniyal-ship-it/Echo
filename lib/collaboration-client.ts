// Client for the real v1 collaboration API, translated through the strict presentation adapter.
import { UNAUTHORIZED_EVENT } from './client';
import {
  adaptCollaboration,
  adaptList,
  snapshotSchema,
  collaborationLimits,
  type Snapshot,
} from './collaboration-adapter';
import { COLLABORATION_VERSION } from './collaboration-types';
import { ContractError } from './collaboration-view';
import type {
  AdvanceRequest,
  CreateRequest,
  TurnRequest,
  WireCollaboration,
  WireList,
} from './collaboration-ui-types';

export type CollaborationFailure =
  /** No response was received; server execution may still have occurred. */
  | 'offline'
  /** The server has no collaboration endpoints (backend not deployed). */
  | 'unavailable'
  /** The session is no longer recognised. */
  | 'signed-out'
  /** The server refused the request and said why (validation, state conflict, limits). */
  | 'rejected'
  /** The server failed. Whether a provider call was made is unknown to the browser. */
  | 'server';
export class CollaborationError extends Error {
  constructor(
    public kind: CollaborationFailure,
    message: string,
    public status?: number,
  ) {
    super(message);
    this.name = 'CollaborationError';
  }
}
type Transport = (input: string, init?: RequestInit) => Promise<Response>;

export function createCollaborationClient(transport: Transport = (i, init) => fetch(i, init)) {
  async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
    let response: Response;
    try {
      response = await transport(`/api/collaborations${path}`, {
        ...init,
        headers: init.body ? { 'Content-Type': 'application/json' } : undefined,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw error;
      throw new CollaborationError(
        'offline',
        'ECHO could not reach the server. Check your connection and try again.',
      );
    }
    let data: unknown = null;
    try {
      data = await response.json();
    } catch {
      /* A non-JSON body is handled by status below. */
    }
    if (response.ok && data && typeof data === 'object') return data as T;
    const message =
      data && typeof data === 'object' && typeof (data as { error?: unknown }).error === 'string'
        ? (data as { error: string }).error
        : '';
    if (response.status === 401) {
      if (typeof window !== 'undefined') window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
      throw new CollaborationError('signed-out', message || 'Sign in to collaborate.', 401);
    }
    if (response.status === 404 && (!message || message === 'Endpoint not found.'))
      throw new CollaborationError(
        'unavailable',
        'The collaboration service is not available on this server yet.',
        404,
      );
    if (response.status >= 500 || response.ok)
      throw new CollaborationError(
        'server',
        message || 'The collaboration service failed. Nothing was changed in this view.',
        response.status,
      );
    throw new CollaborationError(
      'rejected',
      message || `The request was not accepted (${response.status}).`,
      response.status,
    );
  }
  const post = <T>(path: string, body: unknown, signal?: AbortSignal) =>
    call<T>(path, { method: 'POST', body: JSON.stringify(body), signal });
  const id = (value: string) => `/${encodeURIComponent(value)}`;
  const snapshots = new Map<string, Snapshot>();
  const keys = new Map<string, string>();
  const key = (operation: string) => {
    const existing = keys.get(operation);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    keys.set(operation, fresh);
    return fresh;
  };
  function saved(raw: unknown) {
    try {
      const parsed = snapshotSchema.parse(raw);
      const prior = snapshots.get(parsed.id),
        newest = parsed.turns.at(-1)!,
        previous = prior?.turns.at(-1);
      // A slow GET must not replace a newer cancel, stage checkpoint or follow-up.
      if (
        prior &&
        previous &&
        (newest.ordinal < previous.ordinal ||
          (newest.ordinal === previous.ordinal &&
            Date.parse(newest.updated_at) < Date.parse(previous.updated_at)))
      )
        return adaptCollaboration(prior);
      const ui = adaptCollaboration(parsed);
      snapshots.set(parsed.id, parsed);
      return ui;
    } catch {
      throw new ContractError('invalid v1 snapshot');
    }
  }
  const current = async (thread: string) => {
    if (!snapshots.has(thread)) saved(await call(id(thread)));
    return snapshots.get(thread)!.turns.at(-1)!;
  };
  return {
    list: async (signal?: AbortSignal): Promise<WireList> => {
      try {
        return adaptList(await call('', { signal }));
      } catch (error) {
        if (error instanceof CollaborationError || (error as Error).name === 'AbortError')
          throw error;
        throw new ContractError('invalid v1 history');
      }
    },
    get: async (thread: string, signal?: AbortSignal) => saved(await call(id(thread), { signal })),
    create: async (request: CreateRequest) => {
      const operation = 'create:' + JSON.stringify(request);
      const result = saved(
        await post('', {
          version: COLLABORATION_VERSION,
          idempotencyKey: key(operation),
          question: request.task,
          mode: request.mode,
          models: request.models,
          consent: request.consent,
          filters: request.filters,
          limits: collaborationLimits(request.mode),
        }),
      );
      keys.delete(operation);
      return result;
    },
    advance: async (thread: string, request: AdvanceRequest, signal?: AbortSignal) => {
      const t = await current(thread);
      const operation = JSON.stringify([thread, t.id, t.stage, t.status, t.updated_at, request]);
      return saved(
        await post(
          `${id(thread)}/advance`,
          {
            version: COLLABORATION_VERSION,
            turnId: t.id,
            idempotencyKey: key(operation),
            retry: request.action === 'retry',
            acknowledgePossibleDuplicateCharge: request.acknowledgeCharge === true,
          },
          signal,
        ),
      );
    },
    cancel: async (thread: string) => {
      const t = await current(thread);
      return saved(
        await post(`${id(thread)}/cancel`, { version: COLLABORATION_VERSION, turnId: t.id }),
      );
    },
    addTurn: async (thread: string, request: TurnRequest) => {
      const t = await current(thread),
        operation = 'turn:' + JSON.stringify([thread, t.id, request]);
      return saved(
        await post(`${id(thread)}/turns`, {
          ...t.config,
          version: COLLABORATION_VERSION,
          idempotencyKey: key(operation),
          question: request.prompt,
          consent: request.consent,
        }),
      );
    },
  };
}
export type CollaborationClient = ReturnType<typeof createCollaborationClient>;
