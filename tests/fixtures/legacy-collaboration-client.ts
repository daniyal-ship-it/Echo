// Historical Phase 4B presentation fixture ONLY; never imported by the application.
// Isolated client for the planned collaboration endpoints. Nothing else in the frontend calls
// them, so reconciling with the real backend contract means changing this file and the adapter.
import { UNAUTHORIZED_EVENT } from '../../lib/client';
import type {
  AdvanceRequest,
  CreateRequest,
  TurnRequest,
  WireCollaboration,
  WireList,
} from '../../lib/collaboration-ui-types';

export type CollaborationFailure =
  /** The request never reached the server (no network, aborted connection). */
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
  return {
    list: (signal?: AbortSignal) => call<WireList>('', { signal }),
    get: (collaboration: string, signal?: AbortSignal) =>
      call<WireCollaboration>(id(collaboration), { signal }),
    create: (request: CreateRequest) => post<WireCollaboration>('', request),
    advance: (collaboration: string, request: AdvanceRequest, signal?: AbortSignal) =>
      post<WireCollaboration>(`${id(collaboration)}/advance`, request, signal),
    cancel: (collaboration: string) => post<WireCollaboration>(`${id(collaboration)}/cancel`, {}),
    addTurn: (collaboration: string, request: TurnRequest) =>
      post<WireCollaboration>(`${id(collaboration)}/turns`, request),
  };
}
export type CollaborationClient = ReturnType<typeof createCollaborationClient>;
