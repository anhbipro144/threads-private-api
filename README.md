# Threads private messaging research

Latest continuation notes: [agent handoff](docs/agent-handoff.md).

Independent TypeScript research repository; no Shop-AI code is modified.

**Current state (2026-10-28): standalone inbox and message reads reproduced.**
Node retrieved two inbox threads and three messages in the agreed test
conversation with Chrome closed and DevTools disconnected. IDs, ordering,
senders, timestamps and content matched fresh browser baselines in memory.
One explicitly authorized UI test DM was independently confirmed received once
on the second controlled account. Its send protocol and standalone sending remain
unverified. Both MCP servers respond. A project-scoped SDK setting resolves
REA's Swift compiler/SDK mismatch; reconnect the running REA MCP server to use it.
Four matching project-local skills are installed. There is no SDK yet;
`src/index.ts` exports only
a research-status marker. This project is private and cannot be published by accident.

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
2. Inspect `/mcp`: confirm `rea` and `chrome-devtools` connect. Verify that Chrome
   has `--isolated` and **does not** inherit the global `--autoConnect` arguments.
3. Use `list_pages`, then navigate the isolated browser to `https://www.threads.com/`.
   Have the owner sign in to a controlled test account. Do not provide credentials
   to the agent. Keep another owner-controlled test account available separately.
4. Review the successful E1–E3 records in [experiments](docs/experiments.md).
   Session fields expire; obtain fresh owner-authorized session material and
   keep it outside Git. The successful probe held session headers only in memory.
5. Diagnose reads while Chrome stays open. Once they work, take fresh browser
   baselines, disconnect DevTools, close Chrome once, and run the final Node
   comparison. Request exact sender/recipient/content/count authorization before
   E4 sends. Never retry an uncertain send.

The verification script closes its temporary browser on completion. It is not an
interactive authenticated research session. Persistent research profiles require
separate approval and must never be combined with `--isolated`.
The owner explicitly requested attachment to the running Chrome for the recorded
2026-10-28 run; this did not change the default isolated configuration. Chrome's
per-instance debugging access must be checked after reopening it.

## Read-only usage (owner's own inbox)

Reads are the only reproduced capability; no send client is exported. You capture
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
    cursorVariable: 'after', // the cursor variable name as it appears in YOUR capture
  }),
});

try {
  const { threads } = await reader.listThreads();
  for await (const message of reader.allMessages(threads[0]!.id)) console.log(message.messageId);
} catch (error) {
  if (error instanceof ThreadsAuthRequiredError) console.error('reconnect your Threads account');
  else throw error;
}
```

Requests are serialized and spaced by `minIntervalMs` (default 5s, matching the
read experiments) so the `all*` helpers cannot burst. Raise it, don't lower it.
`ThreadsAuthRequiredError` means re-capture the
session; never retry automatically or automate a login. Session lifetime, the
minimum header set and a genuine expiry are untested, and the cursor variable name
is not established by observation — supply the one in your capture.

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
