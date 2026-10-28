# Local website sending backend

**Lifecycle update:** the owner tested the local app successfully and requested
retirement of the website prototype. Its Fastify/Next routes and package were
removed from `tiemdosime-bot`; the reusable handler remains here. The contract
and integration details below record the demonstrated prototype for future work.
See [the milestone](milestones/2026-10-28-local-threads-dm.md).

`createThreadsSendHandler` is implemented and exported. This is a reusable backend
candidate now connected to the website's Fastify routes and private Next proxy
as a local prototype. A credential-free 0.2.0 package was packed and pinned there.
No screen, deployment or new live send was performed.
The underlying Node sender has one independently confirmed controlled delivery.
The handler itself has offline synthetic tests, not a live website-send result.

## Server configuration

Create one long-lived handler per owner, in the API process. Do not create one
per HTTP request or distribute its requests across independent workers. Supply:

- `authorizeOwner(request)`: the host's trusted owner-access check. Reuse the
  existing Tailscale access boundary; no new password is needed. A browser header
  claiming to be the owner is not authorization. Keep public ingress denied.
- `websiteOrigin`: the exact browser-facing origin, including scheme and any
  port, from trusted configuration. Both POST routes require this exact `Origin`
  header and JSON. Do not derive the trusted origin from request headers.
- `conversations`: explicitly consented server-configured conversations, each
  with `threadId`, `senderLabel`, `recipientLabel`, and a synchronous `capture()`
  returning the current `ThreadsTextSendCapture`. Its thread must match this
  configured conversation. Its messaging sender ID must come from observed
  message data, not the form's `av` actor ID. Capture material stays in API memory.
- `journal` (optional): durable random-draft-ID/status storage, created with
  `createFileThreadsSendJournal(privateDirectory)` outside Git. It writes a claim
  before dispatch and lets old attempted IDs report status after restart without
  sending. See [session and recovery setup](session-recovery.md).

The optional `fetchImpl` is for offline tests. The actual provider endpoint is
fixed by the sender. There is no live request when constructing the handler or
preparing a draft. Use the host's normal request timeout as well as body limits.
Disable request/response-body and query logging in the API and proxy.

## Route contract

| Route | JSON body | Result |
| --- | --- | --- |
| `POST /api/threads/drafts` | `{ "threadId": "configured-chat", "text": "exact draft" }` | 201: `draftId`, `threadId`, `senderLabel`, `recipientLabel`, exact `text`, `sendCount: 1`, `status: "prepared"`, `expiresAt` |
| `POST /api/threads/send` | `{ "draftId": "returned-id", "approved": true, "sendCount": 1 }` | 200 `status: "acknowledged"` with acknowledgement, or 202 `status: "sending"` / `"unknown"`; includes `draftId` and `requiresReceiptCheck: true` |

Render the exact returned draft and both configured identities as plain text.
Only the owner's explicit confirmation of that review may submit the send POST.
The confirmation body cannot replace the text, conversation, sender or count.
Editing a draft requires a new preparation and review. Never confirm automatically
on page load, on preparation success, after a timeout, or after restarting.

Concurrent or repeated confirmations reuse the stored outcome and never make
another provider request. An acknowledged response means the provider echoed the
expected message, not independently verified receipt. An unknown outcome requires
checking B; do not offer retry or automatically prepare a replacement message.

All responses are private/no-store, have no cross-origin access grant, and expose
no raw upstream errors or captured session fields. Forward statuses/headers and
JSON through the same-origin Fastify/Next bridge. Preserve the browser's Origin
for validation; do not synthesize a trusted Origin for an untrusted request.

## Limits and failures

There are at most 32 draft records, each expiring 10 minutes after preparation.
Expired records are removed on the next valid request; an in-flight attempt stays
until it settles. This bounds private session material held in memory. JSON input
is limited to 8192 bytes and draft text to 4096 UTF-16 code units; these are local
limits, not discovered Threads limits. No background cleanup, polling or retry
is started. Expired records may remain in memory while the handler is idle.

| Response | Meaning |
| --- | --- |
| 401 `owner_login_required` / 503 `owner_login_unavailable` | Host owner-access check denied/failed |
| 403 `same_origin_required` | Browser Origin missing or different |
| 400 `invalid_*` / `exact_approval_required` | Malformed, oversized, unsupported or incomplete request; nothing sent |
| 404 `not_found` | Conversation or route is outside configured scope |
| 404 `draft_not_found`, `doNotResend: true` | Unknown, expired, or lost-on-restart draft; never reconstruct and resend automatically |
| 429 `draft_limit_reached` | Local draft storage full; no provider request |
| 503 `threads_send_unavailable` | Capture preparation failed; no provider request |
| 503 `threads_reconnect_required` | An attempted send rejected the session; new drafts/unattempted confirmations are paused until owner replacement of the handler/session |
| 503 `threads_send_journal_unavailable`, `doNotResend: true` | Recovery storage could not be claimed/read; no new provider dispatch; never reconstruct an uncertain message |
| 202 `status: "unknown"` | A send was attempted; delivery may have happened; check receipt, never retry |

Draft text/captures stay memory-only. Without a journal, restart loses all draft
state and old IDs are refused. With a journal, attempted IDs return their recovered
`acknowledged` or `unknown` status with `recovered: true` and cannot send. Provider
message IDs were not stored, so a recovered acknowledgement has no acknowledgement
object. The original prototype used the memory-only mode. This does not prevent
intentionally creating another draft for an uncertain message or provide durable
message reconciliation/general multi-instance operation.

## Website hookup — local prototype

The target is `/Users/admin/persona/hustle/tiemdosime-bot`. Implemented routes follow
the existing read bridge: API `/admin/threads/drafts`, `/admin/threads/send`,
private Next proxy `/inbox/threads/api/drafts`, `/inbox/threads/api/send`.
The owner explicitly approved local prototype edits; `AGENTS.md` records that
scoped exception. Existing unrelated website changes were preserved.

The website pins 0.2.0. Host/proxy synthetic tests, builds/typechecks, and a full
Next POST handler → loopback HTTP → compiled Fastify → pinned adapter → stub
provider check passed. Preparing made zero provider calls; two confirmations
made one provider call. Normal website sending stays disabled without private
runtime configuration. Each live message still needs exact A→B
draft/count approval and independent B receipt. Deployment remains paused.
