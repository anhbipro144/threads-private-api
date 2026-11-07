# Handoff: resume E11 (non-text message observation)

> **Out of date (2026-11-07).** E11's live-delta observation has since run, and the SDK
> now parses images and shared posts. Use `E11-NON-TEXT-20261107` in `experiments.md` and
> `integration-readiness-plan.md` for current status. Kept for its history: the earlier
> captioned photo was not analysed, and the read shape is still unobserved.

Written 2026-11-07. Read `AGENTS.md` first, then `docs/integration-readiness-plan.md`.
Real usernames are NOT in this repo (AGENTS.md forbids it). They are in Claude's private
memory: `~/.claude/projects/-Users-admin-persona-hustle-threads-private-api/memory/threads-test-accounts.md`.
Roles used below: **shop account** (receives DMs), **customer-1** (existing test customer),
**customer-2** (third owner account that has never messaged the shop).

The owner wants real usernames used in chat, never "A/B/C", and short plain-language replies.

## Where the code is

- Phase 1 (offline hardening) is done and committed: branch
  `feat/tolerant-non-text-messages`, commit `484aea5`. `main` does not have it yet.
  Check out that branch to continue. Not pushed, not merged.
- It adds the `text | unsupported` message union, serialized callbacks, oldest-first
  dedupe eviction, and the plan file. The commit also widened the `AGENTS.md` test
  scope to three accounts and edited the plan file; the final state was not re-verified
  by the previous session. First step: run `pnpm typecheck`, `pnpm test`, `pnpm build`,
  `pnpm verify:package` on that branch.

## Decisions on record (plan, "Decisions recorded on 2026-11-07")

D1, D2, D5 decided by the owner. D4 now covered by the three accounts above (see the
`AGENTS.md` scope). D3, D6, D7 open and not needed yet.

## Approval already given (and consumed)

E11 run 1: customer-1 -> shop account, existing chat, ONE photo (plain colored square,
no people), caption `synthetic test photo 1`, count 1, sent by the owner by hand in their
Chrome. The owner said "approved" and "photo is sent". That approval is spent: it does
not cover any other message. Never resend. Every further live message needs a new exact
list (sender, recipient, text, count) approved before it is sent.

## What is left for E11 run 1

Record the sanitized SHAPE of that photo message (field names and value types only, no
contents, IDs, URLs, handles or headers), both in a read (`BarcelonaMessageListContainerQuery`
response) and in the live-delta stream if visible. Write the result into
`docs/experiments.md` (E11) and `docs/protocol-map.md` with an evidence level
(OBSERVED if seen once in the browser). Then check what Phase 1's parser does with the
real shape: does it become `unsupported` cleanly, or do the receiver's shape checks
reject it? Fix only from what was observed.

## How to observe safely (this blocked the last session)

- Use the DevTools MCP server `chrome-devtools-redacted` (local scope for this
  folder, started with `--autoConnect --redact-network-headers`). Its tools should
  appear as `mcp__chrome-devtools-redacted__*`.
- Do NOT use the older `mcp__plugin_hm_mcpjungle__chrome-devtools__*` tools to read
  request details: that server runs without header redaction, so cookies and tokens
  would land in the transcript.
- If the new tools are missing, run `/mcp`, check it is enabled, and check Chrome did
  not show a remote-debugging approval prompt. Attach to the owner's existing Chrome only;
  never launch another browser or log in.
- The owner's Chrome must show the shop account's Threads messages page with the
  customer-1 chat open. Look only at that tab. Do not open the other tabs or chats.
- The tab's network list holds lots of unrelated feed/profile traffic. Find the message
  list GraphQL response for this chat; save bodies to `$CLAUDE_JOB_DIR/tmp` or a path
  outside the repo, derive the shape with a script, and keep raw bodies out of Git.
- Reloading the page changes tokens; avoid it unless needed.

## Hard limits that still apply

Owner signs in and handles challenges. Stop on any challenge or warning. No retries of
uncertain sends. No bulk sends. No credentials, message text, IDs or handles in Git, logs
or fixtures. No protocol code from guesses. No commit, push or deploy without the owner's
say-so.

## After E11 run 1

Next candidates need new approved lists: E11 for other kinds (video, voice, sticker,
link, shared post), then E12-E20 per the plan. Phase 2 is a sprint, not one step; revisit
the plan with the results.
