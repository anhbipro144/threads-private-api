# Owner-only website reads

**Lifecycle update:** the owner accepted the local read/send prototype and
requested its cleanup. The website-specific read/send integration is removed;
the reusable reader and handler remain in this repository. The following setup
notes are historical. See [the milestone](milestones/2026-10-28-local-threads-dm.md).

The reusable handler is implemented. The website's Fastify bridge and private
Next.js proxy now consume the pinned local `0.1.1` package. Runtime session setup
and production deployment are separate; see the current handoff for live results.

The owner identified `/Users/admin/persona/hustle/tiemdosime-bot` as the website
repository. Its `apps/api/package.json` identifies Fastify 5 as the API framework.
The owner explicitly authorized the website changes. The broader integration proposal remains in
[shop-ai-integration.md](shop-ai-integration.md).

## Server setup

Import `createThreadsReadHandler` from this project's public entry point. Pass:

- `reader`: one long-lived `ThreadsDmReader`, holding session material only on the
  backend. Reuse it across requests to preserve its request-spacing gate.
- `authorizeOwner(request)`: the host's owner-access check, returning
  `true` only within the owner's authorized access boundary. A customer must not pass. The
  handler denies access on false, any non-true value, or a thrown error. It does
  not implement login or trust a browser-supplied owner flag. For this website,
  the owner confirmed only their devices can access its Tailscale ingress; the
  integration reuses that boundary without an additional password prompt.
- `allowedThreadIds`: a server-configured array of explicitly consented test
  conversation IDs. Never take this list from query parameters or the browser.
  An empty list returns an empty inbox without contacting Threads.

The handler accepts a standard `Request` and returns a `Promise<Response>`.
Use it behind the website's existing same-origin API/authentication boundary.
The implemented Fastify bridge maps `/admin/threads` and
`/admin/threads/messages` to the handler and forwards status, headers and body.
The private website proxy exposes `/inbox/threads/api` and
`/inbox/threads/api/messages`. The API has no host-published port; Admin is
loopback-published, and public Caddy ingress denies these routes. No network rule
was changed. The owner-only Tailscale policy itself has not been independently
queried in this task. The adapter is consumed as a pinned package, without a
cross-repository source import.

## Routes

| Request | Result |
| --- | --- |
| `GET /api/threads?cursor=…` | One inbox page filtered to allowed chats, with `pageInfo` |
| `GET /api/threads/messages?threadId=…&cursor=…` | One page from an allowed chat, with `pageInfo` |

The cursor is optional and opaque. The handler forwards it to the existing reader;
it does not guess the upstream cursor variable. Live traversal is still untested.
An inbox page can be empty after filtering while `hasNextPage` is true. Only
request another page on an owner action; do not automatically crawl or poll.

Missing or disallowed thread IDs return 404 without reading messages. Unknown
parameters, duplicate parameters, empty cursors, and cursors over the local 8192
character limit return 400. Other methods return 405. No send route exists.

All responses use `Cache-Control: private, no-store`. No CORS access is granted.
Disable request/query and response-body logging for these routes in the host and
reverse proxy: they contain private IDs, cursors, or message contents. Render
message text as text, never trusted HTML. Retain HTTPS and the website's normal
session protection. Do not expose the endpoint publicly without the real owner
check, or store session captures in frontend configuration.

## Failure handling

| Status / error | Website behavior |
| --- | --- |
| 401 `owner_login_required` | Ask the owner to sign into the website |
| 503 `owner_login_unavailable` | Show a temporary website-login error |
| 503 `threads_reconnect_required` | Ask the owner to reconnect Threads manually |
| 502 `threads_read_failed` | Show a read failure without raw upstream details |

The handler never retries. It does not return the captured headers/forms or raw
exception text. An inconsistent message response naming another thread is rejected
before returning any content. Upstream reconnect errors do not log the website
owner out; the two sessions are separate.

Offline tests cover denied authorization, authorization failures, chat filtering,
single-page cursor forwarding, invalid input, sanitized failures, no retries, and
inconsistent upstream thread IDs. They establish the local handler's behavior,
not live pagination, genuine session expiry, host authentication, or production
readiness. A separate controlled live check of the compiled Next handler →
Fastify injection → Node fetch matched one allowlisted thread and six messages
against browser baselines. That check fixed the wire text-object mapping in
0.1.1 and denied a disallowed chat. It did not deploy the website or provision a
long-lived runtime session. The platform limitations in [feasibility-report.md](feasibility-report.md)
still apply.
