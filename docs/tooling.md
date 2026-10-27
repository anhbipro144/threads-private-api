# Tooling and reproducibility

Checked 2026-10-27 on macOS arm64. Official documentation was read before setup.

## Preflight

| Tool | Observed version / state |
| --- | --- |
| Global Node | 24.16.0, managed by mise; unchanged |
| Project Node | 24.22.1, pinned npm `node` package |
| npm | 11.13.0 |
| pnpm | 12.15.0 |
| Codex CLI | 0.164.0 |
| curl | 8.7.1 |
| jq | 1.7.1-apple |
| Git | 2.55.0 |
| Google Chrome | 156.0.8078.48, /Applications/Google Chrome.app |
| TypeScript | 6.0.3 |
| Chrome DevTools MCP | 1.12.0 |
| REA | 6.8.0 |

REA 6.8.0's published `engines.node` is
`^22.23.4 || ^24.22.1 || >=26.12.1`. Its verified bin is
`scripts/rea.mjs`; its documented server invocation is `rea-agents mcp`.
Chrome's published bin is `build/src/bin/chrome-devtools-mcp.js` and its engines
allow the selected runtime. Both packages are exact devDependency pins, locked by
pnpm; the MCP entries invoke their local files with the local Node executable.

The initial network-restricted pnpm install stalled and was interrupted. An
approved network-capable install succeeded with a repository-local package store.
Initial TypeScript 7.0.2 required an optional platform binary excluded by
`--no-optional`; selecting TypeScript 6.0.3 resolved this without enabling Frida.
`pnpm-workspace.yaml` is a pnpm install-script policy file, not a monorepo: only
the Node package's install script is allowed. No workspace packages exist.

## Scoped configuration

An existing global `chrome-devtools` registration uses `@latest --autoConnect`.
It was not used or edited. The same project server name overrides it with pinned
local files and `--isolated --redact-network-headers --no-usage-statistics
--no-performance-crux`. `--slim` and `--userDataDir` are absent.

REA's **read-only** `setup --client codex --dry-run --json` proposed changing
`~/.codex/config.toml` and installing `~/.agents/skills/reverse-engineer-anything`.
`appliedActions` was empty. That plan was not applied. Manual project registration
and copies of the matching packaged skills fulfill the requested local scope.
The preview used the exact installed 6.8.0 executable, the release npm `latest`
resolved to during preflight, instead of downloading it again through npx.

`doctor --client codex --json` reported Node healthy but user-level registration
drift and absent optional engines. It checks global registration, not the manual
project config or live Codex connection. Ghidra, Hopper, IDA, JADX, Frida, ADB,
emulators, and mitmproxy were not installed. REA depends transitively on
playwright-core; no Playwright MCP or additional browser server was configured.

`codex mcp list --json` **with the working directory set to this repository**
resolved both local entries and exact isolated Chrome flags. No trust settings
were written. Invoking the listing from another working directory can show the
inherited global entry; always change directory first.

## Actual MCP verification

The checked-in `scripts/verification/mcp-smoke.ts` connects directly over stdio
JSON-RPC, initializes the server, lists tools, invokes them, and closes resources.
This proves server operation; it does not prove that this already-running parent
Codex conversation hot-loaded the project tools.

| Server | Actual result |
| --- | --- |
| Chrome | initialize; tools/list: 32 tools |
| Chrome | list_pages: passed, temporary isolated browser |
| Chrome | navigate_page: example.com passed |
| Chrome | take_snapshot: passed |
| Chrome | list_network_requests: passed |
| Chrome | get_network_request: public request passed |
| Chrome | evaluate_script: public title/origin passed |
| REA | initialize; tools/list: 229 tools |
| REA | inspect_analysis_settings: passed |

The optional `pnpm verify:mcp chrome --threads-public` also navigated to Threads:
origin `https://www.threads.com`, title `Threads`, loginVisible true, inboxVisible
false. No cookies or page bodies were logged. No authenticated session existed.
REA's JavaScript tools are advertised, but no DM-specific bundle analysis has
been performed: the prerequisite observed DM code path is unavailable.

## Skills and restart

Installed only reverse-engineer-anything, chrome-devtools, cookie-debugging, and
troubleshooting. See [.agents/skills/PROVENANCE.md](../.agents/skills/PROVENANCE.md).
pnpm also reports optional automatic skill approval; do not run broad `pnpm approve`
for this task. The four desired skill copies are already explicitly installed.

Open this repository in a new Codex session, inspect `/mcp`, then invoke actual
native `list_pages` and a read-only REA tool before claiming active-agent readiness.
If Codex prompts for trust, the owner must approve the reviewed project. A project
cannot grant itself trust by writing its own config. Persistent authenticated
research profiles need separate approval; temporary isolated login does not.

## Sources

- [Chrome official versioned README](https://github.com/ChromeDevTools/chrome-devtools-mcp/blob/chrome-devtools-mcp-v1.12.0/README.md)
- [REA installation](https://github.com/morluto/rea/blob/rea-agents-6.8.0/docs/installation.md)
- [REA npm metadata](https://registry.npmjs.org/rea-agents/6.8.0)
- [Chrome npm metadata](https://registry.npmjs.org/chrome-devtools-mcp/1.12.0)
- [Codex project-scoped MCP configuration](https://learn.chatgpt.com/docs/extend/mcp#connect-codex-to-an-mcp-server)
