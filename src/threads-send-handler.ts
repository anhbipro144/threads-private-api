import { randomUUID } from 'node:crypto';
import {
  ThreadsTextSendAttempt,
  ThreadsSendOutcomeUnknownError,
  type ThreadsTextSendAcknowledgement,
  type ThreadsTextSendCapture,
} from './threads-dm-send.ts';
import type { ThreadsSendJournal } from './threads-send-journal.ts';

export interface ThreadsSendConversation {
  readonly threadId: string;
  readonly senderLabel: string;
  readonly recipientLabel: string;
  /** Return current private session material for this exact consented conversation. */
  readonly capture: () => ThreadsTextSendCapture;
}

export interface ThreadsSendHandlerOptions {
  readonly authorizeOwner: (request: Request) => boolean | Promise<boolean>;
  /** Exact browser-facing origin from trusted server configuration, including port. */
  readonly websiteOrigin: string;
  readonly conversations: readonly ThreadsSendConversation[];
  readonly fetchImpl?: typeof fetch;
  /** Private durable status storage; never stores session material or draft text. */
  readonly journal?: ThreadsSendJournal;
}

type Outcome = { status: 'prepared' | 'sending' | 'unknown'; reconnectRequired?: boolean }
  | { status: 'acknowledged'; acknowledgement?: ThreadsTextSendAcknowledgement };

interface Draft {
  readonly review: {
    draftId: string; threadId: string; senderLabel: string; recipientLabel: string;
    text: string; sendCount: 1;
  };
  readonly expiresAt: number;
  readonly attempt: ThreadsTextSendAttempt;
  outcome: Outcome;
}

async function body(request: Request): Promise<unknown> {
  if (!request.body) throw new Error();
  const reader = request.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let size = 0, text = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new Error(); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** One long-lived owner-only handler: prepare immutable drafts, confirm each at most once. */
export function createThreadsSendHandler(options: ThreadsSendHandlerOptions): (request: Request) => Promise<Response> {
  try {
    if (new URL(options.websiteOrigin).origin !== options.websiteOrigin) throw new Error();
  } catch { throw new Error('Threads send handler: websiteOrigin must be an exact origin'); }
  const conversations = new Map<string, ThreadsSendConversation>();
  for (const conversation of options.conversations) {
    if (![conversation.threadId, conversation.senderLabel, conversation.recipientLabel].every(v => v.trim()) ||
        conversations.has(conversation.threadId)) throw new Error('Threads send handler: invalid conversation configuration');
    conversations.set(conversation.threadId, { ...conversation });
  }
  const drafts = new Map<string, Draft>();
  let reconnectRequired = false;
  const reply = (status: number, data: unknown, headers: Record<string, string> = {}): Response =>
    Response.json(data, { status, headers: {
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers,
    } });

  return async request => {
    try {
      if (await options.authorizeOwner(request) !== true) return reply(401, { error: 'owner_login_required' });
    } catch { return reply(503, { error: 'owner_login_unavailable' }); }
    const url = new URL(request.url);
    if (url.pathname !== '/api/threads/drafts' && url.pathname !== '/api/threads/send') return reply(404, { error: 'not_found' });
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' }, { Allow: 'POST' });
    if (request.headers.get('Origin') !== options.websiteOrigin) return reply(403, { error: 'same_origin_required' });
    if (url.search || request.headers.get('Content-Type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
      return reply(400, { error: 'invalid_request' });
    }
    let input: unknown;
    try { input = await body(request); } catch { return reply(400, { error: 'invalid_body' }); }
    if (!record(input)) return reply(400, { error: 'invalid_body' });
    for (const [id, draft] of drafts) {
      // Never evict an in-flight attempt: its outcome still needs to be recorded.
      if (draft.expiresAt <= Date.now() && draft.outcome.status !== 'sending') drafts.delete(id);
    }
    if (url.pathname === '/api/threads/drafts') {
      if (Object.keys(input).some(k => k !== 'threadId' && k !== 'text') ||
          typeof input['threadId'] !== 'string' || typeof input['text'] !== 'string' ||
          !input['text'].trim() || input['text'].length > 4096) return reply(400, { error: 'invalid_draft' });
      const conversation = conversations.get(input['threadId']);
      if (!conversation) return reply(404, { error: 'not_found' });
      if (reconnectRequired) return reply(503, { error: 'threads_reconnect_required' });
      if (drafts.size >= 32) return reply(429, { error: 'draft_limit_reached' });
      let attempt: ThreadsTextSendAttempt;
      try {
        const capture = conversation.capture();
        const variables = JSON.parse(new URLSearchParams(capture.body).get('variables') ?? 'null');
        if (!record(variables) || variables['thread_fbid'] !== conversation.threadId) throw new Error();
        attempt = new ThreadsTextSendAttempt({ capture, text: input['text'],
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {}),
        });
      } catch { return reply(503, { error: 'threads_send_unavailable' }); }
      const review = { draftId: randomUUID(), threadId: conversation.threadId,
        senderLabel: conversation.senderLabel, recipientLabel: conversation.recipientLabel,
        text: input['text'], sendCount: 1 as const,
      };
      const draft: Draft = { review, attempt, expiresAt: Date.now() + 10 * 60_000, outcome: { status: 'prepared' } };
      drafts.set(review.draftId, draft);
      return reply(201, { ...review, ...draft.outcome, expiresAt: draft.expiresAt });
    }
    if (Object.keys(input).some(k => !['draftId', 'approved', 'sendCount'].includes(k)) ||
        typeof input['draftId'] !== 'string' || input['draftId'].length > 128 ||
        input['approved'] !== true || input['sendCount'] !== 1) return reply(400, { error: 'exact_approval_required' });
    const draft = drafts.get(input['draftId']);
    if (!draft) {
      try {
        const status = await options.journal?.get(input['draftId']);
        if (status) return reply(status === 'acknowledged' ? 200 : 202, {
          draftId: input['draftId'], status: status === 'acknowledged' ? 'acknowledged' : 'unknown',
          recovered: true, requiresReceiptCheck: true,
        });
      } catch { return reply(503, { error: 'threads_send_journal_unavailable', doNotResend: true }); }
      return reply(404, { error: 'draft_not_found', doNotResend: true });
    }
    if (draft.outcome.status === 'prepared') {
      if (reconnectRequired) return reply(503, { error: 'threads_reconnect_required' });
      draft.outcome = { status: 'sending' };
      if (options.journal) {
        try {
          if (!await options.journal.claim(draft.review.draftId)) {
            const status = await options.journal.get(draft.review.draftId);
            draft.outcome = { status: status === 'acknowledged' ? 'acknowledged' : 'unknown' };
          }
        } catch {
          draft.outcome = { status: 'unknown' };
          return reply(503, { error: 'threads_send_journal_unavailable', doNotResend: true });
        }
      }
      if (draft.outcome.status === 'sending') {
        try {
          const acknowledgement = await draft.attempt.send();
          await options.journal?.complete(draft.review.draftId, 'acknowledged');
          draft.outcome = { status: 'acknowledged', acknowledgement };
        } catch (error) {
          if (error instanceof ThreadsSendOutcomeUnknownError && error.reconnectRequired) reconnectRequired = true;
          draft.outcome = { status: 'unknown', ...(error instanceof ThreadsSendOutcomeUnknownError && error.reconnectRequired
            ? { reconnectRequired: true } : {}) };
          // The durable claim already prevents replay even if the final status write fails.
          await options.journal?.complete(draft.review.draftId, 'unknown').catch(() => undefined);
        }
      }
    }
    return reply(draft.outcome.status === 'acknowledged' ? 200 : 202, {
      draftId: draft.review.draftId, ...draft.outcome, requiresReceiptCheck: true,
    });
  };
}
