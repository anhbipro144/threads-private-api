# Threads private messaging research

Independent TypeScript research repository; no Shop-AI code is modified.

**Current state (2026-10-27): setup verified, authenticated research blocked.**
Isolated Chrome MCP passed all six requested tools. REA MCP initialized and a
read-only tool passed. Four matching project-local skills are installed. No
Threads DM endpoint, authenticated session, or browser-independent DM operation
has been verified. There is deliberately no SDK yet; `src/index.ts` exports only
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
4. Start E1–E3 in [experiments](docs/experiments.md). Export no raw traffic into Git.
5. Reproduce authenticated read operations with Chrome closed. Request explicit
   recipient-specific authorization before E4 sends. Never retry an uncertain send.

The verification script closes its temporary browser on completion. It is not an
interactive authenticated research session. Persistent research profiles require
separate approval and must never be combined with `--isolated`.

## Results and boundaries

- [Feasibility report and completion checklist](docs/feasibility-report.md)
- [Sources and current implementation research](docs/research-log.md)
- [Protocol evidence map](docs/protocol-map.md)
- [Experiment rules and records](docs/experiments.md)
- [Future Shop-AI adapter design](docs/shop-ai-integration.md)
- [Scope and SDK acceptance gate](docs/specification.md)
- [Mobile investigation decision](docs/mobile-findings.md)

No GitHub remote is configured. No credentials, private messages, or raw captures
were collected. Ordinary checks never contact Threads or send messages.
