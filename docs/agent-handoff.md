# Threads DM website integration — engineering handoff

Updated 2026-10-28. Repository: `/Users/admin/persona/hustle/threads-private-api`.
Canonical resumable state. Detailed records: `docs/experiments.md`,
`docs/protocol-map.md`, `docs/research-log.md`, `docs/feasibility-report.md`, `README.md`.

## Project purpose and scope

**Product goal:** let the owner connect their own Threads DM inbox to their
website, to display messages and eventually send replies in conversations they
are authorized to manage. This is an application-integration prototype, not a
security assessment of Threads or of other users' accounts.

**Why protocol observation is involved:** the messaging interface is undocumented,
so the project studies the behavior of the owner's own normal web client using
owner-controlled test accounts and a consented test conversation. Never describe
it as an official or supported Meta API.

**Operating limits:** only the owner's authorized session and the two
owner-controlled test accounts. Do not access third-party conversations, hunt for
weaknesses, defeat authentication or access controls, evade rate limits or
platform protections, harvest other users' data, or automate unsolicited
messages. Keep credentials and private messages out of logs, commits and durable
agent memory. Any new test send needs explicit, message-specific owner approval.

## Current state

**Reads — REPRODUCED and implemented.**
`BarcelonaMessagesThreadListMailboxQuery` and `BarcelonaMessageListContainerQuery`
(POST `https://www.threads.com/api/graphql`) ran in Node with Chrome fully closed
and DevTools disconnected; thread IDs and ordered message IDs, senders, timestamps
and content matched fresh in-memory browser baselines. No comparison values were
printed or committed.

Implemented in `src/threads-dm-read.ts`, exported from `src/index.ts`:

- `ThreadsDmReader.listThreads(cursor?)` / `listMessages(threadId, cursor?)`.
- `allThreads()` / `allMessages(threadId)` async generators follow `page_info`
  cursors with a `maxPages` cap (throws instead of looping on a stuck cursor).
- Validating parsers (`parseThreadList`, `parseMessageList`, `parseGraphqlEnvelope`)
  throw at the trust boundary rather than returning partial data.
- `ThreadsAuthRequiredError` on HTTP 401/403 and on the documented HTTP-200
  rejection envelope (numeric top-level `error`; code 1357054 observed), carrying
  `.code`. GraphQL `errors[]` stays a generic failure. Messages never include the
  response body.
- `minIntervalMs` rate cap (default 5000, matching the read experiments) serializes
  requests through a promise gate so concurrent callers and the `all*` helpers
  cannot burst. Tests pass 0; README says raise it, never lower it.
- `sessionFromCapturedForms()` builds a session from request bodies the owner
  captured themselves, rewriting only `thread_fbid` and a caller-named cursor
  variable inside the form's JSON `variables`; all other captured fields pass
  through unchanged. It performs no capture itself.

**Cursor variable name is deliberately caller-supplied** — it was never observed.
Omitting `cursorVariable` makes the `all*` helpers single-page rather than guessing.

**Sends — VERIFIED in the UI, wire op OBSERVED, Node send NOT built.**

- Two owner-approved sends A→B, each clicked once, each independently confirmed by
  the owner as received exactly once on B. **Both authorizations are exhausted.**
- The second send's wire operation was observed with a metadata-only in-page hook
  installed before page scripts (via `navigate_page initScript`): ~260 ms after the
  click, an XHR POST to `/api/graphql` with
  `fb_api_req_friendly_name=WmiSlideTextMessageMutation`. Only 1-byte and 8-byte
  frames appeared on `gateway.threads.com/ws/lightspeed`, so **the earlier
  MQTT/Lightspeed transport hypothesis is corrected: the text send is a GraphQL
  mutation over HTTP, not WebSocket.** No Workers were created. The payload was
  deliberately not read (`get_network_request` returns session tokens).
- Variables/response mapped statically from a public asset — see the "Send message"
  row in `docs/protocol-map.md` for the doc id, variable names and response field.
  `executeMessageSend` disposes the optimistic row and rethrows: **no client retry.**
  Server-side dedupe on `offline_threading_id` is unknown.
- A standalone Node send was **not** attempted and is gated behind the
  platform-compliance assessment (below). Do not build one from static shape alone.

**Compliance gate.** `docs/feasibility-report.md` now carries a
platform-compliance assessment: CONDITIONAL GO for read-only, owner-only,
on-demand, low-volume reading of the owner's own inbox; NO-GO for a standalone
Node send path. The owner stated they accept the unofficial-interface risk for
read-only own-account use, which satisfies the read condition by owner decision.
No official Threads DM API exists (overview 2026-07-02, changelog 2026-08-18).

**Still open:** a genuine session expiry was never exercised (1357054 was seen with
stale/reduced headers, so treat it as "rejected at the auth/validation layer", not
proof of expiry); pagination traversal untested against the live service; incoming
synchronization (Iris deltas remain HYPOTHESIS) and restart recovery; media and
non-TEXT message types; minimum header set.

## Authorization, privacy, and working preferences

Engineering acceptance criteria, not optional. If a step exceeds approved scope,
stop and ask for specific permission.

- Read `AGENTS.md` and `docs/experiments.md` before live research. Only the two
  owner-controlled accounts and the agreed test chat are in scope. The owner
  handles authentication and challenges. Never retry an uncertain send.
- **No send is currently authorized.** A generic "proceed" or "continue" is not
  recipient-specific send authorization. Obtain the exact sender, recipient,
  displayed draft and count, then require independent B receipt confirmation.
- The owner explicitly requested attaching to their running Chrome; the read probe
  kept session headers in memory only. Do not ask them to export header files again
  unless a new constraint requires it. Default project Chrome config stays isolated;
  do not edit global configuration or inspect other profiles.
- The owner was frustrated by repeated Chrome-closure requests. Diagnose with Chrome
  open. The browser-closed read requirement already passed; do not repeat that cycle.
- Approval review previously rejected saving unredacted authentication headers
  (memory-only was the accepted path) and force-ending shared Chrome (unsaved-work
  risk; the owner quit it manually).
- Never log or commit cookies, CSRF/token values, account IDs, message contents,
  private URLs or raw traffic. Keep private captures out of any persistent
  knowledge index. Do not modify sibling repositories or create a remote.
- **Communication:** `AGENTS.md` now requires plain language with everyday
  analogies and brief replies when explaining status or trade-offs to the owner.

## Static analysis artifacts (public code only)

Public assets were fetched without cookies and read as inert text; nothing
downloaded was executed. No session material is needed to re-examine them.

- **Send mutation module:** `/private/tmp/threads-mutation-static-vgYQyJ/a17.js`,
  SHA-256 `e4816be35fe86fa905b5419ebe28ae985fa8027549eae8ee53ffd2bee7b6423f`
  (source URL recorded in `urls.txt` beside it). Contains
  `WmiSlideTextMessageMutation.threads.graphql`, `sendTextMessage`,
  `executeMessageSend`, `WmiNormalizedMutation`, `WmiOfflineThreadingId`.
  `offline_threading_id` = 63-bit (ms timestamp then 22 random bits).
- **Earlier message-bundle analysis:** `/private/tmp/threads-send-static-r6fGHk/`
  holds three public assets, sanitized manifest/hashes, an inert
  `useBarcelonaMessagesSendMedia` excerpt with provenance, and a ~15 MB REA
  evidence bundle (parent evidence
  `ev_a0ea897399d250cf99356e8b136695f151aa451b6208d9405ad09b2ea5935600`). Derive
  focused summaries; never dump it into context. REA coverage was partial
  (`statistics.modules = 0`; retention caps hit), so it does not establish a call graph.
- The dispatcher in `WmiSlideSendPublicApi` has two branches (`SlideWebDIPlatform`
  runtime vs `SlideAppPlatform`); which one the web client takes was never
  determined, and it no longer matters for the read deliverable.
- REA ran via the project-pinned CLI with a process-local `SDKROOT`; the native MCP
  server needed a reconnect to inherit the owner's fix. No global toolchain or
  settings were changed by any agent.

## Temporary artifacts (outside Git, may vanish)

Check existence before use; never treat filenames as durable credentials.

| Path | Purpose / caution |
| --- | --- |
| `/private/tmp/threads-controlled-*/` (4 dirs) | **Private captures** — snapshots and request bodies with sensitive values despite header redaction. Never dump or index. In `-iFG1DS`: capture 12 = agreed-chat snapshot, 25 = message read, 63 = mailbox read. Deletion was offered and not authorized. |
| `/private/tmp/threads-memory-read-replay.mjs` | The successful in-memory Node read probe. Not running; its runtime credentials were discarded. |
| `/private/tmp/threads-controlled-dm.mjs` | Past one-DM UI controller. **Do not issue `send-approved` without new exact authorization.** Its immediate-capture strategy missed the wire op. |
| `/private/tmp/threads-send-bundle-inventory.mjs`, `threads-extract-send-module.mjs` | Read-only public-asset collector and AST extractor; never invoke downloaded code. |
| `/private/tmp/threads-send-static-r6fGHk/`, `/private/tmp/threads-mutation-static-vgYQyJ/` | Public assets and derived evidence (see above). |

Reuse `scripts/verification/stdio-mcp.ts` for MCP orchestration and the project's
Node executable. Never print server stderr or full authenticated tool responses.
Keep one MCP client alive for an observer rather than reopening clients.

No analysis process is in flight; the two previously noted idle broker PIDs
(71400, 73828) no longer exist. No send is in flight.

## Next steps (only when explicitly resumed)

Prefer work that needs no live action. Nothing below authorizes a send.

1. **Live read validation** (needs owner go-ahead and an available session):
   exercise pagination against the real service and deliberately expire or
   invalidate a session to confirm `ThreadsAuthRequiredError` fires on a genuine
   expiry. This closes the last read-side unknowns.
2. **Website wiring:** expose the reader behind the owner's own backend endpoint.
   Session material stays server-side and never reaches the browser or the repo.
3. **Incoming synchronization:** unresearched. Iris deltas / `slide_gql` via
   `SlideUQPPDeltasQuery` are HYPOTHESIS only; do not claim push or "live".
4. **Node send:** blocked. It needs a positive platform-terms review first, then a
   fresh message-specific approval and independent B confirmation. Because there is
   no client retry and server dedupe is unknown, a Node send must never retry — on
   an uncertain result, read the thread back and look for the
   `offline_threading_id`.

## Working tree and validation

This session's work is committed as `7385457` ("feat: add read-only DM reader;
document observed send operation"). No remote exists and nothing was pushed.
`.codex/config.toml` and `docs/tooling.md` edits were the owner's own (REA SDKROOT
scoping) and were preserved in that commit. `.claude/skills/*` symlinks were
created by the harness and left untracked on purpose. No sibling repository or
global shell/Nix/Codex setting was modified.

Last checks actually run, all passing: `pnpm typecheck`, `pnpm test` (18 tests),
`pnpm build`. Tests use synthetic fixtures and a stubbed `fetch` — they never
contact Threads. Do not rerun live experiments merely to validate a checkpoint.

Local checkpoint skill: `.agents/skills/save-progress/SKILL.md` (`$save-progress`),
also linked at `.claude/skills/save-progress`.
