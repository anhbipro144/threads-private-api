/**
 * Read-only Threads DM adapter for the owner's own website backend.
 *
 * Scope is deliberately display-only: list the owner's conversations and read a
 * conversation's messages. Both operations were REPRODUCED in Node against
 * `POST /api/graphql` (see docs/protocol-map.md, E2/E3). Sending is NOT part of
 * this module — its wire operation is only OBSERVED once, not reproduced in Node.
 *
 * The caller owns the authenticated session and passes it in; this module never
 * stores, logs, or inspects session material. Parsers validate the response
 * shape at the trust boundary and throw on anything unexpected rather than
 * returning partial data.
 */

export const THREADS_GRAPHQL_ENDPOINT = 'https://www.threads.com/api/graphql';

/** A single conversation in the inbox listing. */
export interface ThreadSummary {
  readonly id: string;
}

/** One message in a conversation. */
export interface DmMessage {
  readonly messageId: string;
  readonly threadFbid: string;
  readonly senderFbid: string;
  readonly timestampMs: string;
  readonly content: string;
}

/** Relay-style forward-pagination cursor. */
export interface PageInfo {
  readonly hasNextPage: boolean;
  readonly endCursor: string | null;
}

export interface ThreadListPage {
  readonly threads: readonly ThreadSummary[];
  readonly pageInfo: PageInfo;
}

export interface MessageListPage {
  readonly messages: readonly DmMessage[];
  readonly pageInfo: PageInfo;
}

/**
 * Everything needed to replay one owner-authenticated GraphQL read. The caller
 * supplies the exact form body and headers it captured from its own session
 * (the operation name, doc_id, fb_dtsg, variables and the auth headers live
 * here). This module treats the whole thing as opaque and never reads it.
 */
export interface ThreadsReadRequest {
  readonly body: string;
  readonly headers: Readonly<Record<string, string>>;
}

export interface ThreadsDmReadSession {
  /**
   * Builds request material for `BarcelonaMessagesThreadListMailboxQuery`. On a
   * follow-up page the caller injects `cursor` into its captured variables (the
   * exact variable name lives in the caller's capture); this module only forwards
   * the result and never guesses that name.
   */
  readonly listThreads: (cursor?: string) => ThreadsReadRequest;
  /**
   * Builds request material for `BarcelonaMessageListContainerQuery` against one
   * thread, optionally at a page `cursor`. The caller injects `threadId` and
   * `cursor` into its captured variables; this module only forwards the result.
   */
  readonly listMessages: (threadId: string, cursor?: string) => ThreadsReadRequest;
}

export interface ThreadsDmReaderOptions {
  readonly session: ThreadsDmReadSession;
  readonly endpoint?: string;
  /** Injectable for tests; defaults to the global fetch. */
  readonly fetchImpl?: typeof fetch;
  /**
   * Minimum gap between requests, serialized across concurrent calls. Keeps the
   * on-demand, low-volume posture the compliance assessment relies on — notably
   * for the `all*` pagination helpers, which would otherwise burst. Default
   * matches the 5s interval the read experiments used. Set 0 only in tests.
   */
  readonly minIntervalMs?: number;
}

/**
 * The request was rejected before it produced data, so the owner must supply a
 * fresh session capture. Callers should surface this as "owner re-auth required"
 * and must not retry or automate a login.
 *
 * Observed trigger: HTTP 200 with a numeric top-level `error` (code 1357054, with
 * a null payload) when form tokens or headers were stale/reduced. A genuinely
 * expired session has not been tested, so treat the code as "rejected at the
 * auth/validation layer" rather than proof of expiry specifically.
 */
export class ThreadsAuthRequiredError extends Error {
  readonly code: number | null;
  constructor(detail: string, code: number | null = null) {
    super(`Threads read: owner re-auth required (${detail})`);
    this.name = 'ThreadsAuthRequiredError';
    this.code = code;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function requireString(value: unknown, where: string): string {
  if (typeof value !== 'string') throw new Error(`Threads read: expected string at ${where}`);
  return value;
}

/** GraphQL responses are prefixed with an anti-hijack `for(;;);` guard. */
export function parseGraphqlEnvelope(text: string): Record<string, unknown> {
  const json = JSON.parse(text.replace(/^for\s*\(;;\);\s*/, ''));
  if (!isObject(json)) throw new Error('Threads read: response is not an object');
  // A numeric top-level `error` is the HTTP-200 rejection envelope, not a GraphQL error.
  if (typeof json['error'] === 'number') {
    throw new ThreadsAuthRequiredError('HTTP 200 rejection envelope', json['error']);
  }
  if (Array.isArray(json['errors']) && json['errors'].length > 0) {
    throw new Error(`Threads read: GraphQL returned ${json['errors'].length} error(s)`);
  }
  if (!isObject(json['data'])) throw new Error('Threads read: response has no data');
  return json['data'];
}

function parsePageInfo(connection: Record<string, unknown>): PageInfo {
  const pageInfo = connection['page_info'];
  if (!isObject(pageInfo)) return { hasNextPage: false, endCursor: null };
  const endCursor = pageInfo['end_cursor'];
  return {
    hasNextPage: pageInfo['has_next_page'] === true,
    endCursor: typeof endCursor === 'string' ? endCursor : null,
  };
}

function edges(connection: unknown, where: string): readonly unknown[] {
  if (!isObject(connection) || !Array.isArray(connection['edges'])) {
    throw new Error(`Threads read: missing edges at ${where}`);
  }
  return connection['edges'];
}

export function parseThreadList(data: Record<string, unknown>): ThreadListPage {
  const mailbox = data['get_slide_mailbox_for_iris_subscription'];
  if (!isObject(mailbox)) throw new Error('Threads read: missing mailbox');
  const connection = mailbox['threads_by_folder'];
  const threads = edges(connection, 'threads_by_folder').map((edge, i) => {
    if (!isObject(edge) || !isObject(edge['node'])) {
      throw new Error(`Threads read: bad thread edge at index ${i}`);
    }
    return { id: requireString(edge['node']['id'], `thread[${i}].id`) };
  });
  return { threads, pageInfo: parsePageInfo(connection as Record<string, unknown>) };
}

export function parseMessageList(data: Record<string, unknown>): MessageListPage {
  const thread = data['get_slide_thread'];
  if (!isObject(thread)) throw new Error('Threads read: missing thread');
  const connection = thread['messages'];
  const messages = edges(connection, 'messages').map((edge, i) => {
    if (!isObject(edge) || !isObject(edge['node'])) {
      throw new Error(`Threads read: bad message edge at index ${i}`);
    }
    const node = edge['node']['as_micg_interface'];
    if (!isObject(node)) throw new Error(`Threads read: message[${i}] has no as_micg_interface`);
    return {
      messageId: requireString(node['message_id'], `message[${i}].message_id`),
      threadFbid: requireString(node['thread_fbid'], `message[${i}].thread_fbid`),
      senderFbid: requireString(node['sender_fbid'], `message[${i}].sender_fbid`),
      timestampMs: requireString(node['timestamp_ms'], `message[${i}].timestamp_ms`),
      content: requireString(node['content'], `message[${i}].content`),
    };
  });
  return { messages, pageInfo: parsePageInfo(connection as Record<string, unknown>) };
}

export interface CapturedForms {
  /** Captured `BarcelonaMessagesThreadListMailboxQuery` form body. */
  readonly threadListBody: string;
  /** Captured `BarcelonaMessageListContainerQuery` form body. */
  readonly messageListBody: string;
  /** Captured request headers (cookie, csrf, etc.). Held by the caller, never logged. */
  readonly headers: Readonly<Record<string, string>>;
  /**
   * Name of the GraphQL variable carrying a forward cursor. NOT established by
   * observation — the read queries' cursor variable was never exercised — so the
   * caller must supply the name it sees in its own capture. Omit to disable
   * cursor injection, which makes the `all*` helpers single-page.
   */
  readonly cursorVariable?: string;
}

/**
 * Builds a session from request bodies the owner captured from their own browser.
 *
 * The captured body is form-urlencoded with a JSON `variables` field; this rewrites
 * only `thread_fbid` (documented for the message query) and the caller-named cursor
 * variable, leaving every other captured field byte-identical. It parses the
 * owner's own material and performs no capture itself.
 */
export function sessionFromCapturedForms(capture: CapturedForms): ThreadsDmReadSession {
  const rebuild = (body: string, changes: Readonly<Record<string, string | undefined>>): string => {
    const form = new URLSearchParams(body);
    const raw = form.get('variables');
    if (raw === null) throw new Error('Threads read: captured body has no variables field');
    let variables: unknown;
    try {
      variables = JSON.parse(raw);
    } catch {
      throw new Error('Threads read: captured variables is not valid JSON');
    }
    if (!isObject(variables)) throw new Error('Threads read: captured variables is not an object');
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) variables[key] = value;
    }
    form.set('variables', JSON.stringify(variables));
    return form.toString();
  };
  const cursorChange = (cursor: string | undefined): Record<string, string | undefined> =>
    capture.cursorVariable !== undefined && cursor !== undefined ? { [capture.cursorVariable]: cursor } : {};
  return {
    listThreads: (cursor) => ({
      body: rebuild(capture.threadListBody, cursorChange(cursor)),
      headers: capture.headers,
    }),
    listMessages: (threadId, cursor) => ({
      body: rebuild(capture.messageListBody, { thread_fbid: threadId, ...cursorChange(cursor) }),
      headers: capture.headers,
    }),
  };
}

/**
 * Narrowly scoped read-only client. Each method replays one owner-captured
 * request and parses the response. On a non-200 (e.g. an expired session), it
 * throws with the status only — never the body — so the caller can surface
 * "owner re-auth required" without leaking session material. It never retries.
 */
export class ThreadsDmReader {
  readonly #session: ThreadsDmReadSession;
  readonly #endpoint: string;
  readonly #fetch: typeof fetch;
  readonly #minIntervalMs: number;
  #lastRequestAt = 0;
  #gate: Promise<void> = Promise.resolve();

  constructor(options: ThreadsDmReaderOptions) {
    this.#session = options.session;
    this.#endpoint = options.endpoint ?? THREADS_GRAPHQL_ENDPOINT;
    this.#fetch = options.fetchImpl ?? fetch;
    this.#minIntervalMs = options.minIntervalMs ?? 5000;
  }

  /** Serializes requests and spaces them by at least `minIntervalMs`. */
  async #waitForTurn(): Promise<void> {
    const turn = this.#gate.then(async () => {
      const wait = this.#minIntervalMs - (Date.now() - this.#lastRequestAt);
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      this.#lastRequestAt = Date.now();
    });
    this.#gate = turn.catch(() => undefined);
    return turn;
  }

  async #read(request: ThreadsReadRequest): Promise<Record<string, unknown>> {
    await this.#waitForTurn();
    const response = await this.#fetch(this.#endpoint, {
      method: 'POST',
      headers: { ...request.headers },
      body: request.body,
      redirect: 'error',
    });
    if (response.status === 401 || response.status === 403) {
      throw new ThreadsAuthRequiredError(`HTTP ${response.status}`);
    }
    if (response.status !== 200) {
      throw new Error(`Threads read: HTTP ${response.status}`);
    }
    return parseGraphqlEnvelope(await response.text());
  }

  async listThreads(cursor?: string): Promise<ThreadListPage> {
    return parseThreadList(await this.#read(this.#session.listThreads(cursor)));
  }

  async listMessages(threadId: string, cursor?: string): Promise<MessageListPage> {
    return parseMessageList(await this.#read(this.#session.listMessages(threadId, cursor)));
  }

  /** Yields every conversation, following `page_info` cursors on demand. */
  async *allThreads(maxPages = 50): AsyncGenerator<ThreadSummary> {
    yield* this.#paginate(maxPages, (cursor) => this.listThreads(cursor), (p) => p.threads);
  }

  /** Yields every message in a thread, following `page_info` cursors on demand. */
  async *allMessages(threadId: string, maxPages = 50): AsyncGenerator<DmMessage> {
    yield* this.#paginate(maxPages, (cursor) => this.listMessages(threadId, cursor), (p) => p.messages);
  }

  // shortcut: hard page cap guards against a cursor that never terminates; raise maxPages if a real inbox legitimately exceeds it.
  async *#paginate<T, P extends { pageInfo: PageInfo }>(
    maxPages: number,
    fetchPage: (cursor?: string) => Promise<P>,
    items: (page: P) => readonly T[],
  ): AsyncGenerator<T> {
    let cursor: string | undefined;
    for (let page = 0; page < maxPages; page++) {
      const result = await fetchPage(cursor);
      yield* items(result);
      if (!result.pageInfo.hasNextPage || result.pageInfo.endCursor === null) return;
      cursor = result.pageInfo.endCursor;
    }
    throw new Error(`Threads read: pagination exceeded ${maxPages} pages`);
  }
}
