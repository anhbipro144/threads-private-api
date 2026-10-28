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
It was not edited. The project server overrides it with pinned local files and
`--autoConnect --redact-network-headers --no-usage-statistics
--no-performance-crux`. The owner explicitly requires attachment to their running
remote-debugging Chrome; never launch a second isolated browser. This supersedes
the initial isolated setup recorded below. `--slim` and `--userDataDir` are absent.

The current Chrome debugging UI exposed a server at `127.0.0.1:9222`, but standard
`/json/version` discovery returned 404. The supported `--autoConnect` handshake
attached successfully to the owner's already-authenticated Threads tab without
another login. Enable debugging on `chrome://inspect/#remote-debugging` in that
same Chrome, and accept a connection prompt if shown. Reconnect the project MCP
server after changing flags; an already-running server retains its old settings.

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
resolved both local entries and the then-current isolated Chrome flags. No trust settings
were written. Invoking the listing from another working directory can show the
inherited global entry; always change directory first.

## Actual MCP verification

The checked-in `scripts/verification/mcp-smoke.ts` connects directly over stdio
JSON-RPC, initializes the server, lists tools, invokes them, and closes resources.
It now attaches with `--autoConnect` and owns a new public test tab; it closes only
that tab and its MCP connection, leaving the owner's Chrome running.
This proves server operation; it does not prove that this already-running parent
Codex conversation hot-loaded the project tools.

| Server | Actual result |
| --- | --- |
| Chrome | initialize; tools/list: 32 tools |
| Chrome | list_pages: passed, temporary isolated browser (initial setup) |
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
At this initial checkpoint, no DM-specific bundle analysis had been performed.

## REA Swift SDK fix — 2026-10-28

The active REA server connected and its settings tool worked, but a provider
helper failed to compile: installed Swift 6.3.3 selected a macOS 27 SDK built
with Swift 6.4. The installed macOS 26.5 SDK compiled successfully with the same
compiler. Setting `SDKROOT` for the REA process alone resolved the failure.

The project-scoped `.codex/config.toml` now sets `SDKROOT` to
`/Library/Developer/CommandLineTools/SDKs/MacOSX26.5.sdk` in `mcp_servers.rea.env`.
Codex's resolved project configuration reports that value and the project-pinned
Node/REA launcher. Global Codex settings, the Chrome entry and system toolchain
were not changed. Reconnect the REA MCP server or restart this project session:
an already-running server keeps its original environment. If the installed SDK
changes or disappears, recheck compiler/SDK compatibility before updating this
machine-specific project setting.

Validation used both the pinned REA CLI and an actual newly launched, project-
pinned REA MCP server. The CLI analyzed one previously downloaded public bundle;
the MCP server analyzed the 744,266-character public messaging bundle that
contains the observed read-query module names. The MCP analysis returned parent
Evidence `ev_799d5c4f6ec7591e2009ecfe7f62fa8df52ad3aa7711faa32984bf23aa6dd24d`.
The selected-source graph was partial and its semantic node/unknown limits were
reached, so it does not prove any send transport or establish absence of one.
The portable public-source Evidence bundle was exported outside this repository
to `/private/tmp/rea-static-evidence.Hsy0EOZN/evidence.json` and verified as
valid JSON containing the retained parent Evidence. Temporary paths may be
removed by the operating system.
The existing `pnpm verify:mcp rea` settings smoke test alone does not exercise
this compiler-dependent analysis path.

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
