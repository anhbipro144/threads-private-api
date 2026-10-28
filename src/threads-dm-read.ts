/**
 * Read-only Threads DM adapter for the owner's own website backend.
 *
 * Scope is deliberately display-only: list the owner's conversations and read a
 * conversation's messages. Both operations were REPRODUCED in Node against
 * `POST /api/graphql` (see docs/protocol-map.md, E2/E3). Sending is NOT part of
 * this module — the separate single-attempt text sender has its own safeguards.
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

export type ThreadsSessionStatus = 'configured' | 'ready' | 'reconnect-required' | 'disconnected';

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

export function parseMessageList(data: Record<string, unknown>, expectedThreadId?: string): MessageListPage {
  if ('get_slide_thread' in data && 'fetch__SlideThread' in data) throw new Error('Threads read: ambiguous message roots');
  const thread = data['get_slide_thread'] ?? data['fetch__SlideThread'];
  if (!isObject(thread)) throw new Error('Threads read: missing thread');
  const connection = thread['messages'];
  const messages = edges(connection, 'messages').map((edge, i) => {
    if (!isObject(edge) || !isObject(edge['node'])) {
      throw new Error(`Threads read: bad message edge at index ${i}`);
    }
    const node = edge['node']['as_micg_interface'];
    if (!isObject(node)) throw new Error(`Threads read: message[${i}] has no as_micg_interface`);
    const threadFbid = requireString(node['thread_fbid'], `message[${i}].thread_fbid`);
    if (expectedThreadId !== undefined && threadFbid !== expectedThreadId) throw new Error('Threads read: unexpected conversation');
    const content = node['content'];
    if (!isObject(content)) throw new Error(`Threads read: message[${i}] has no text content object`);
    return {
      messageId: requireString(node['message_id'], `message[${i}].message_id`),
      threadFbid,
      senderFbid: requireString(node['sender_fbid'], `message[${i}].sender_fbid`),
      timestampMs: requireString(node['timestamp_ms'], `message[${i}].timestamp_ms`),
      content: requireString(content['text_body'], `message[${i}].content.text_body`),
    };
  });
  return { messages, pageInfo: parsePageInfo(connection as Record<string, unknown>) };
}

export interface CapturedForms {
  /** Captured `BarcelonaMessagesThreadListMailboxQuery` form body. */
  readonly threadListBody: string;
  /** Captured `BarcelonaMessageListContainerQuery` form body. */
  readonly messageListBody: string;
  /** Observed BarcelonaMessageListPaginationQuery form for the initial capture's conversation. */
  readonly messagePaginationBody?: string;
  /** Captured request headers (cookie, csrf, etc.). Held by the caller, never logged. */
  readonly headers: Readonly<Record<string, string>>;
  /**
   * Caller-observed mailbox cursor variable; live inbox pagination is unverified.
   * Message pagination instead uses the separately captured form's `after`.
   * A requested mailbox cursor without this name fails before provider dispatch.
   */
  readonly cursorVariable?: string;
}

/**
 * Builds a session from request bodies the owner captured from their own browser.
 *
 * The captured body is form-urlencoded with a JSON `variables` field; this rewrites
 * only `thread_fbid` for initial reads, or `after` on the distinct observed message
 * pagination form. The pagination form's Relay node `id` is never rewritten.
 * Mailbox cursors remain caller-named. Other captured fields are preserved. It parses the
 * owner's own material and performs no capture itself.
 */
export function sessionFromCapturedForms(capture: CapturedForms): ThreadsDmReadSession {
  const unpack = (body: string): { form: URLSearchParams; variables: Record<string, unknown> } => {
    const form = new URLSearchParams(body);
    if (form.getAll('variables').length > 1) throw new Error('Threads read: captured variables field is ambiguous');
    const raw = form.get('variables');
    if (raw === null) throw new Error('Threads read: captured body has no variables field');
    let variables: unknown;
    try {
      variables = JSON.parse(raw);
    } catch {
      throw new Error('Threads read: captured variables is not valid JSON');
    }
    if (!isObject(variables) || Array.isArray(variables)) throw new Error('Threads read: captured variables is not an object');
    return { form, variables };
  };
  const rebuild = (body: string, changes: Readonly<Record<string, string | undefined>>): string => {
    const { form, variables } = unpack(body);
    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) variables[key] = value;
    }
    form.set('variables', JSON.stringify(variables));
    return form.toString();
  };
  const cursorChange = (cursor: string | undefined): Record<string, string> => {
    if (cursor === undefined) return {};
    if (!capture.cursorVariable) throw new Error('Threads read: captured mailbox cursor variable required');
    return { [capture.cursorVariable]: cursor };
  };
  return {
    listThreads: (cursor) => ({
      body: rebuild(capture.threadListBody, cursorChange(cursor)),
      headers: capture.headers,
    }),
    listMessages: (threadId, cursor) => {
      if (cursor === undefined) return {
        body: rebuild(capture.messageListBody, { thread_fbid: threadId }), headers: capture.headers,
      };
      if (!capture.messagePaginationBody) throw new Error('Threads read: captured message pagination form required');
      if (!cursor) throw new Error('Threads read: message cursor must be nonempty');
      const initial = unpack(capture.messageListBody);
      const pagination = unpack(capture.messagePaginationBody);
      const first = pagination.variables['first'];
      if (initial.variables['thread_fbid'] !== threadId ||
          pagination.form.getAll('fb_api_req_friendly_name').length !== 1 ||
          pagination.form.get('fb_api_req_friendly_name') !== 'BarcelonaMessageListPaginationQuery' ||
          pagination.form.getAll('doc_id').length !== 1 || !/^\d+$/.test(pagination.form.get('doc_id') ?? '') ||
          (initial.form.has('av') && pagination.form.get('av') !== initial.form.get('av')) ||
          typeof pagination.variables['id'] !== 'string' || !pagination.variables['id'] ||
          typeof first !== 'number' || !Number.isSafeInteger(first) || first < 1 ||
          pagination.variables['before'] != null || pagination.variables['last'] != null ||
          !('after' in pagination.variables) || 'thread_fbid' in pagination.variables) {
        throw new Error('Threads read: pagination capture must match the initial conversation and observed query');
      }
      return {
        body: rebuild(capture.messagePaginationBody, { after: cursor }),
        headers: { ...capture.headers, 'x-fb-friendly-name': 'BarcelonaMessageListPaginationQuery' },
      };
    },
  };
}

/**
 * Narrowly scoped read-only client. Each method replays one owner-captured
 * request and parses the response. On a non-200 (e.g. an expired session), it
 * throws with the status only — never the body — so the caller can surface
 * "owner re-auth required" without leaking session material. It never retries.
 */
export class ThreadsDmReader {
  #session: ThreadsDmReadSession | null;
  #sessionStatus: ThreadsSessionStatus = 'configured';
  #sessionVersion = 0;
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

  /** Local state, not a claim about server-side session lifetime. */
  get sessionStatus(): ThreadsSessionStatus { return this.#sessionStatus; }

  /** The owner supplies a fresh session; no login or automatic retry is performed. */
  replaceSession(session: ThreadsDmReadSession): void {
    this.#session = session;
    this.#sessionVersion++;
    this.#sessionStatus = 'configured';
  }

  disconnect(): void {
    this.#session = null;
    this.#sessionVersion++;
    this.#sessionStatus = 'disconnected';
  }

  #requireSession(): ThreadsDmReadSession {
    if (!this.#session || this.#sessionStatus === 'reconnect-required') {
      throw new ThreadsAuthRequiredError('owner must supply a replacement session');
    }
    return this.#session;
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

  async #read(build: (session: ThreadsDmReadSession) => ThreadsReadRequest): Promise<Record<string, unknown>> {
    this.#requireSession();
    await this.#waitForTurn();
    const session = this.#requireSession();
    const version = this.#sessionVersion;
    const request = build(session);
    try {
      const response = await this.#fetch(this.#endpoint, {
        method: 'POST', headers: { ...request.headers }, body: request.body, redirect: 'error',
      });
      if (response.status === 401 || response.status === 403) throw new ThreadsAuthRequiredError(`HTTP ${response.status}`);
      if (response.status !== 200) throw new Error(`Threads read: HTTP ${response.status}`);
      const data = parseGraphqlEnvelope(await response.text());
      if (version !== this.#sessionVersion) throw new Error('Threads read: session changed; discard old response');
      // Another in-flight read may have rejected this session; only replacement clears that state.
      if (this.sessionStatus === 'reconnect-required') {
        throw new ThreadsAuthRequiredError('owner must supply a replacement session');
      }
      this.#sessionStatus = 'ready';
      return data;
    } catch (error) {
      if (version !== this.#sessionVersion) throw new Error('Threads read: session changed; discard old response');
      if (error instanceof ThreadsAuthRequiredError) this.#sessionStatus = 'reconnect-required';
      throw error;
    }
  }

  async listThreads(cursor?: string): Promise<ThreadListPage> {
    return parseThreadList(await this.#read(session => session.listThreads(cursor)));
  }

  async listMessages(threadId: string, cursor?: string): Promise<MessageListPage> {
    return parseMessageList(await this.#read(session => session.listMessages(threadId, cursor)), threadId);
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
