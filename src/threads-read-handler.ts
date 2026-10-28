import { ThreadsAuthRequiredError, type ThreadsDmReader } from './threads-dm-read.ts';

export interface ThreadsReadHandlerOptions {
  /** Reuse one server-side reader so its request spacing applies across visits. */
  readonly reader: Pick<ThreadsDmReader, 'listThreads' | 'listMessages'>;
  /** Validate the website's own login and owner identity. Never trust a browser flag. */
  readonly authorizeOwner: (request: Request) => boolean | Promise<boolean>;
  /** Explicitly consented conversations, supplied by trusted server configuration. */
  readonly allowedThreadIds: readonly string[];
}

/** Same-origin, owner-only, single-page reads. No server, login, polling, or sends. */
export function createThreadsReadHandler(options: ThreadsReadHandlerOptions): (request: Request) => Promise<Response> {
  const allowedThreads = new Set(options.allowedThreadIds);
  const reply = (status: number, data: unknown, headers: Record<string, string> = {}): Response =>
    Response.json(data, {
      status,
      headers: { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', ...headers },
    });

  return async (request) => {
    try {
      if (await options.authorizeOwner(request) !== true) {
        return reply(401, { error: 'owner_login_required' });
      }
    } catch {
      return reply(503, { error: 'owner_login_unavailable' });
    }

    const url = new URL(request.url);
    if (url.pathname !== '/api/threads' && url.pathname !== '/api/threads/messages') {
      return reply(404, { error: 'not_found' });
    }
    if (request.method !== 'GET') {
      return reply(405, { error: 'method_not_allowed' }, { Allow: 'GET' });
    }

    const messages = url.pathname === '/api/threads/messages';
    const params = url.searchParams;
    if ([...params.keys()].some((key) =>
      (key !== 'cursor' && !(messages && key === 'threadId')) || params.getAll(key).length !== 1,
    )) return reply(400, { error: 'invalid_query' });

    const cursor = params.get('cursor');
    if (cursor !== null && (cursor.length === 0 || cursor.length > 8192)) {
      return reply(400, { error: 'invalid_cursor' });
    }
    const threadId = params.get('threadId');
    if (messages && (threadId === null || !allowedThreads.has(threadId))) {
      return reply(404, { error: 'not_found' });
    }

    try {
      if (messages && threadId !== null) {
        const page = await options.reader.listMessages(threadId, cursor ?? undefined);
        // Refuse an inconsistent upstream result rather than expose another chat.
        if (page.messages.some((message) => message.threadFbid !== threadId)) {
          return reply(502, { error: 'threads_read_failed' });
        }
        return reply(200, page);
      }
      if (allowedThreads.size === 0) {
        return reply(200, { threads: [], pageInfo: { hasNextPage: false, endCursor: null } });
      }
      const page = await options.reader.listThreads(cursor ?? undefined);
      return reply(200, {
        threads: page.threads.filter((thread) => allowedThreads.has(thread.id)),
        pageInfo: page.pageInfo,
      });
    } catch (error) {
      return error instanceof ThreadsAuthRequiredError
        ? reply(503, { error: 'threads_reconnect_required' })
        : reply(502, { error: 'threads_read_failed' });
    }
  };
}
