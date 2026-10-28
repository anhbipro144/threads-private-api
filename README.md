# Threads private messaging research

Latest continuation notes: [agent handoff](docs/agent-handoff.md).

**Milestone:** the owner successfully tested the local reading/sending prototype.
The temporary website integration was then removed at the owner's request;
the reusable adapter remains here. See [the milestone record](docs/milestones/2026-10-28-local-threads-dm.md).

Independent TypeScript research repository; no Shop-AI code is modified.

**Current state (2026-10-28): standalone reads reproduced; one controlled Node text send verified.**
Node retrieved two inbox threads and three messages in the agreed test
conversation with Chrome closed and DevTools disconnected. IDs, ordering,
senders, timestamps and content matched fresh browser baselines in memory.
Two explicitly authorized UI test DMs were each independently confirmed received
once on the second controlled account. The send operation was observed as
`WmiSlideTextMessageMutation`. A subsequent separately approved direct Node send
made one request, validated the acknowledgement, and was independently confirmed
received on B. Production sending remains subject to the compliance gate.
Both MCP servers responded in the recorded run.
A project-scoped SDK setting resolves
REA's Swift compiler/SDK mismatch; reconnect the running REA MCP server to use it.
Project-local research and checkpoint skills are installed. `src/index.ts`
exports the reader, captured-form helper, parsers, an owner-only website read
handler, and the single-attempt text sender. The previously packed private `0.1.1` artifact remains read-only; it has explicit compiled exports
and a bounded distribution file list. This project remains private.

## Setup

```sh
cd /Users/admin/persona/hustle/threads-private-api
pnpm install --frozen-lockfile --no-optional --store-dir .cache/pnpm-store
pnpm typecheck
pnpm test
pnpm build
pnpm verify:mcp rea
pnpm verify:mcp chrome
```

The project pins its own Node 24.22.1 as a development dependency. `pnpm` scripts
use that runtime without changing mise or global defaults. Use
`./node_modules/node/bin/node` for direct script execution. Optional dependencies
are omitted to avoid installing Frida; TypeScript 6.0.3 needs no native compiler.
`lint` currently performs TypeScript checks; no separate style linter is installed.

MCP commands use absolute paths for this machine. Update both entries in
`.codex/config.toml` if the checkout moves. See [tool readiness](docs/tooling.md).

## Resume the investigation

1. Open this directory as a new Codex project, or run `codex` from this directory.
   Review/trust the project if prompted; no user-level trust settings were changed.
2. Inspect `/mcp`: confirm `rea` and `chrome-devtools` connect. Chrome must use
   `--autoConnect` to attach to the owner's existing remote-debugging instance.
   The owner explicitly requires this; do not launch an isolated browser.
3. Use `list_pages` and select the existing authenticated Threads tab. The owner
   handles sign-in or challenges if needed. Never ask for another sign-in in a
   second browser. Keep the second controlled test account available separately.
4. Review the successful E1–E3 records in [experiments](docs/experiments.md).
   Session fields expire; obtain fresh owner-authorized session material and
   keep it outside Git. The successful probe held session headers only in memory.
5. Diagnose reads while Chrome stays open. The Chrome-closed Node read comparison
   already passed; do not repeat the closure cycle. Request exact
   sender/recipient/content/count authorization before E4 sends. Never retry an
   uncertain send.

The Chrome verification script attaches to the running browser, opens its own
temporary public test tab, and closes only that tab on completion. It does not
navigate or close the owner's existing tabs. Chrome's per-instance debugging
access must be enabled at `chrome://inspect/#remote-debugging`. The native MCP
registration needs a reconnect to pick up changed project flags. `--autoConnect`
supports that Chrome handshake; plain `/json/version` discovery returned 404 in
the recorded run even while debugging was enabled.

## Read-only usage (owner's own inbox)

The reader accepts two observed read requests. You capture
the two read requests from your own signed-in browser (DevTools → the
`BarcelonaMessagesThreadListMailboxQuery` and `BarcelonaMessageListContainerQuery`
POSTs → copy request body and headers), then hand them to the adapter. Keep that
material server-side; never commit it or send it to the browser.

```ts
import { ThreadsDmReader, ThreadsAuthRequiredError, sessionFromCapturedForms } from './src/index.ts';

const reader = new ThreadsDmReader({
  session: sessionFromCapturedForms({
    threadListBody: process.env.THREAD_LIST_BODY!,   // captured form body
    messageListBody: process.env.MESSAGE_LIST_BODY!, // captured form body
    headers: JSON.parse(process.env.THREADS_HEADERS!),
    // Optional: messagePaginationBody from this same conversation's observed older-page query.
    // cursorVariable is only for a caller-observed mailbox cursor.
  }),
});

try {
  const { threads } = await reader.listThreads();
  // Read only the agreed test conversation; render data privately, never log it.
  if (threads.some((thread) => thread.id === agreedTestThreadId)) {
    const page = await reader.listMessages(agreedTestThreadId);
    // Pass page to the authenticated owner's view.
  }
} catch (error) {
  if (error instanceof ThreadsAuthRequiredError) console.error('reconnect your Threads account');
  else throw error;
}
```

Requests are serialized and spaced by `minIntervalMs` (default 5s, matching the
read experiments) so the `all*` helpers cannot burst. Raise it, don't lower it.
`ThreadsAuthRequiredError` means re-capture the
session; never retry automatically or automate a login. Session lifetime, the
minimum header set and a genuine expiry are untested. Message pagination uses a
separate captured query and its observed `after` cursor; mailbox pagination is
still unverified. The example's
`agreedTestThreadId` must come from trusted server-side configuration.

The observed text response wraps text in `content.text_body`; the reader returns
that text as `DmMessage.content`. Version `0.1.1` fixes the earlier parser's
incorrect plain-string assumption. Non-text content is currently rejected.

Older-message pagination is now reproduced for two controlled one-message pages
in the browser and Node. Supply `messagePaginationBody` for the same captured
conversation; the helper preserves its Relay node ID and uses the pagination
response root. Missing pagination configuration fails before dispatch instead
of repeating a page. See [pagination evidence and setup](docs/message-pagination.md).

## Controlled text sending

`ThreadsTextSendAttempt` sends one plain-text message in the captured existing
conversation. Supply a `ThreadsTextSendCapture` (send form body, headers, and
`senderFbid` from observed messaging data) plus `text`. The messaging sender ID
differs from the form's `av` actor ID; do not substitute one for the other.
Keep all capture material server-side and in memory.

Construct the attempt without sending, review the exact sender, recipient and
draft, then obtain approval for one send before calling `attempt.send()`.
It replaces only the text and offline ID, fixes the captured conversation,
refuses redirects, and validates the response's conversation, messaging sender,
offline ID, text, message ID and timestamp. Reusing the same attempt is blocked,
including simultaneous calls and failed requests. An acknowledgement is not
independent receipt: the receiving controlled account must check the message.

`ThreadsSendOutcomeUnknownError` means delivery may have happened. Check B;
never retry or construct another attempt for the same uncertain message.
The consumed-attempt guard is in memory only and does not survive a restart.
Server deduplication and restart recovery are unverified. There is no automatic
retry, login, session storage, media support or website send route.

One approved direct Node send and independent B receipt passed while Chrome
remained open; no UI Send click was used. Browser-closed sending was not tested.
This is an unofficial, controlled prototype, not a production-readiness claim.

## Session reconnect and restart recovery

The reader exposes `sessionStatus`, stops further reads after an auth rejection,
and accepts an owner-supplied `replaceSession(...)`. `disconnect()` removes the
managed session; old in-flight results cannot overwrite a replacement session.
No login or retry is automatic.

The send handler can use `createFileThreadsSendJournal(privateDirectory)` to
persist only random draft IDs and outcome states before dispatch. After restart,
old attempted IDs return status without resending. Credentials and message text
remain in memory. Sending auth rejection requests reconnect while keeping that
attempt's outcome unknown. See [session and recovery setup](docs/session-recovery.md).

## Website backend handler

`createThreadsReadHandler()` wraps the reader with a required owner-login check
and a server-configured list of consented chats. It exposes one page per request,
disables response caching, and sanitizes failures. It starts no server and makes
no live requests until called. See [website wiring](docs/website-read-handler.md)
for the route contract and integration requirements.

The target website is `/Users/admin/persona/hustle/tiemdosime-bot` (Shop-AI,
Fastify API). Its temporary Fastify/Next bridges and plain local test form passed
the owner's test, then were removed at their request. They reused the existing
Tailscale boundary without an extra password. No production deployment occurred.
That repository retains `docs/threads-milestone.md`; no prototype route is active.

`createThreadsSendHandler()` now provides a separate local backend candidate:
prepare an immutable draft, review its exact text and identities, then explicitly
confirm one send. Repeated confirmations cannot resend the stored attempt;
unknown delivery requires checking receipt. See [sending route contract](docs/website-send-handler.md).
It was exercised through the local Fastify/Next prototype with synthetic tests
and the owner's live test. Website prototype code is now removed; the reusable
handler remains here for future integration.

## Results and boundaries

- [Feasibility report and completion checklist](docs/feasibility-report.md)
- [Sources and current implementation research](docs/research-log.md)
- [Protocol evidence map](docs/protocol-map.md)
- [Experiment rules and records](docs/experiments.md)
- [Future Shop-AI adapter design](docs/shop-ai-integration.md)
- [Scope and SDK acceptance gate](docs/specification.md)
- [Mobile investigation decision](docs/mobile-findings.md)

No GitHub remote is configured. Private captures remain outside the repository;
no credentials, identifiers or message contents are recorded in tracked findings.
Ordinary checks never contact Threads or send messages.
