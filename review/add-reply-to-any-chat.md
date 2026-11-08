# Review: add-reply-to-any-chat

- **Change:** OpenSpec `add-reply-to-any-chat` (specs `dm-send`, `session-capture`)
- **Scope:** workspace changes on local branch `develope`, base `HEAD` = `1813a87`; no merge base (workspace mode)
- **Exclusions:** `review/**`; OCR also excluded Markdown (`unsupported_ext`) and `tests/**` (`default_path`). Those files were still read as specs, tests and evidence.
- **Date:** 2026-11-08
- **Status:** verified 2026-11-08. Both findings were resolved and verified; see "Solution verification" at the end. The original findings are kept below.

## Builder follow-up — 2026-11-08

- **M1 resolved:** the owner explicitly confirmed the permission in this
  conversation and clarified its scope: free operation as main account A in the
  two agreed chats; ask before operating customer B or C. No further confirmation
  is needed. The session-capture spec, proposal, design, task guidance and user
  guide now allow the owner or an authorized agent to send in the capture tab,
  while the capture command only observes and never types, clicks Send or sends.
  `AGENTS.md` now states that distinction directly, without a specs-override
  clause. Completed E25 owner-sent steps remain identified as historical evidence.
  D5 and D7 retain the owner's current main-account-only permission; production
  AI sending remains undecided.
- **L1 resolved:** the session-capture gap row now describes the repository's
  capture command, optional send template, successful E25 run and unknown
  session/template lifetime (E20).
- **Verification:** strict OpenSpec validation, typecheck, 99 unit tests, build,
  package verification (92 installed-package tests and JS/TS consumers), and
  `git diff --check` passed. These fixes change documentation only. No new live
  request, message, commit or push was performed.

## Findings

### Medium

#### M1. Who types the capture message: specs say only the owner, `AGENTS.md` now lets the agent

- **path:** `AGENTS.md`
- **start_line / end_line:** 26–43
- **category:** documentation
- **severity:** medium
- **content:**
  - **What the new text says:** the `AGENTS.md` diff lets the agent "perform capture-message steps itself" (line 30). It also says this permission "supersedes … owner-typed capture instructions in plans, specs and handoffs" (line 38).
  - **What this change's own artifacts say:**
    - the `session-capture` spec, line 11, is titled "send template from the owner's own message";
    - spec line 12 says it waits "for the owner to send one message there themselves";
    - `proposal.md:17` and `design.md:40` say the same;
    - `docs/session-recovery.md:78` tells the reader to send a message "you type and send yourself".
  - **Why it matters:** a policy file that declares it overrides the spec leaves the two contradicting each other. The next agent cannot tell whether typing the capture message through DevTools is allowed. The script itself never types or sends (`scripts/capture-session.ts:126-155` only reads network requests), so the code meets the spec either way.
  - **The same widening in other files:**
    - D5 and D7 in `docs/integration-readiness-plan.md:29-31,44-46` changed from per-run approval of exact messages to standing permission;
    - D7 now counts AI sends in controlled tests as covered.
  - **Not verified by the reviewer:** whether the owner gave this 2026-11-08 permission. No owner statement of it appears in this review's evidence.
  - **Fix:**
    1. The owner confirms the `AGENTS.md`, D5 and D7 wording.
    2. Then choose one:
       - make the spec requirement neutral, for example "a person in the capture tab sends one message; the capture never sends";
       - or remove the "supersedes … specs" clause and keep owner-typed capture.
    3. Keep `docs/session-recovery.md` consistent with whichever is chosen.

### Low

#### L1. The readiness plan still says "No tool in the repo" for session capture

- **path:** `docs/integration-readiness-plan.md`
- **start_line / end_line:** 81–81
- **category:** documentation
- **severity:** low
- **content:** The gap table row "Session capture | No tool in the repo; old helpers were in `/private/tmp`" is stale. `pnpm capture-session` exists since `0b13663`, and this change adds `--with-send`. This change updated the neighbouring rows of the same table ("Only one chat works per capture", "Quote replies") but left this one. Update the row to the current state: the owner-run capture with an optional send template; template lifetime unknown (E20).

## Checked and not reported

- **`threadId` option** (`src/threads-dm-send.ts:93-101`):
  - the template is validated first, then `thread_fbid` is overridden;
  - the override target is also used for the echo check (`:126`);
  - an empty, blank or non-string ID is refused before any request;
  - `createThreadsSendHandler` (`src/threads-send-handler.ts:105-112`) does not pass `threadId`, so it stays bound to its configured chat.
- **Template helper** (`scripts/capture-send-template.ts`):
  - it validates with the SDK's own constructor and never sends;
  - it rejects a quote, mention, forward, photo, wrong chat or malformed request;
  - the saved body holds only the placeholder;
  - headers are copied, not shared;
  - failure reasons carry no values.
- **Capture wiring** (`scripts/capture-session.ts`):
  - `--with-send` without `--thread` exits with code 2 before Chrome is touched;
  - the tab opens in the foreground only with the flag;
  - only requests new since the prompt are examined;
  - other mutations are skipped;
  - any failure throws before `saveThreadsSession`, which matches the docs' "nothing saved";
  - the post-save check only constructs an attempt;
  - nothing is printed except step names and booleans or counts.
- **Privacy scan of the doc diffs** (`AGENTS.md`, `CHANGELOG.md`, `README.md`, `docs/*`): no handles, account or chat IDs, message IDs, message text, private URLs or local paths were added. The doc IDs in `docs/protocol-map.md` are on lines that were already there.
- **Considered and discarded:**
  - the post-save check runs after the file is written. This is the existing pattern for the inbox and receiver checks, and the helper has already run the same validation before saving;
  - near the 3-minute deadline, a DevTools call can time out with `MCP request timed out` instead of `sendTemplateMissing`. Nothing is saved, and the docs already say to check the chat after any failure.

## Verification performed now

| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm test` | 99 tests, 99 pass, 0 fail (includes the new `capture-send-template`, `capture-session-args` and 3 new `threads-dm-send` tests) |
| `pnpm build` | pass |
| `openspec validate add-reply-to-any-chat --strict` | valid |
| Doc diff scan for long digit runs, `@handles`, `mid.$`, private hosts and local paths | no matches in added lines (one existing `mid.$…` placeholder) |

**Historical evidence, not rerun:** E25-CAPTURE-CROSS-CHAT-20261108 in `docs/experiments.md` records the live capture, two SDK sends and the owner's receipt check, plus `pnpm verify:package`. This review did not run `verify:package`, any live Threads request or Chrome.

**Limitations:**

- The `--with-send` wait loop (detecting new requests, skipping other mutations, the deadline) has no offline test. It is covered only by the single live run.
- How long a send template stays valid is unknown (E20).

## Coverage

- **total_files:** 4
- **reviewed_files:** 4
- **skipped_files:** 0
- **coverage_rate:** 100%

| path | status | result |
|---|---|---|
| `scripts/capture-session.ts` | modified | reviewed |
| `src/threads-dm-send.ts` | modified | reviewed |
| `openspec/changes/add-reply-to-any-chat/.openspec.yaml` | added | reviewed (keys `schema`, `created`; no typos) |
| `scripts/capture-send-template.ts` | added | reviewed |

These 15 files were excluded by OCR but read as context:

- `AGENTS.md`, `CHANGELOG.md`, `README.md`;
- `docs/experiments.md`, `docs/integration-readiness-plan.md`, `docs/protocol-map.md`, `docs/session-recovery.md`;
- the three test files;
- the five OpenSpec artifacts.

No fixes were applied during this review.

## Solution verification — 2026-11-08

The builder's "resolved" labels were checked against the current files. The code
under review is unchanged since the original review:

- the diff stat still shows `scripts/capture-session.ts` +46/−6, `src/threads-dm-send.ts` +8/−2 and the tests +43;
- the builder states the fixes were documentation-only.

### M1: verified resolved

- **`AGENTS.md:39-41`:**
  - now separates the two roles: during a capture as A, the agent may type and send the test message in the capture tab, and the capture command itself only observes and never types or sends;
  - the "supersedes … specs" clause is gone; completed experiment records are labelled historical instead.
- **`specs/session-capture/spec.md:11-16`:**
  - the requirement is now "from an authorized operator's message";
  - an operator is defined as the owner or an agent the owner authorized;
  - the "capture command SHALL NOT type, click send or send" rule is kept, so the spec and `AGENTS.md` now agree.
- **`docs/session-recovery.md:78-91`:**
  - now says "You or an authorized agent type and send";
  - says the command only observes;
  - points to `AGENTS.md` for the A versus B/C scope.
- **Searches:**
  - the proposal, design, recovery guide and plan no longer contain "supersede" or the owner-only wording;
  - the one remaining owner-only line is `tasks.md:22` (task 3.2, already checked). It records how the completed E25 run happened, so it is accurate history, not a conflict.
- **D5/D7** (`docs/integration-readiness-plan.md:29,31,44,46`):
  - limited to main account A in the two agreed chats, with B/C needing the owner;
  - production AI sending stays open.
- **Owner confirmation:**
  - the builder notes that the owner confirmed this permission in the builder's conversation;
  - the reviewer did not see that statement. It is recorded as the builder's claim, and the owner can correct it.

### L1: verified resolved

`docs/integration-readiness-plan.md:81` now describes:

- `pnpm capture-session`;
- the optional `--with-send --thread …` template with placeholder text and no send by the command;
- the E25 live check;
- the unknown session and template lifetime (E20).

### Checks run for this verification

| Check | Result |
|---|---|
| `pnpm typecheck` | pass |
| `pnpm test` | 99 tests, 99 pass, 0 fail |
| `pnpm build` | pass |
| `openspec validate add-reply-to-any-chat --strict` | valid |
| `git diff --check` | clean |
| Privacy scan of added doc lines (long digit runs, `@handles`, private hosts, local paths) | 0 matches |

**Not rerun:** `pnpm verify:package` (the builder reports it passed), and any live Threads request.

**Result:** verified. No builder work is pending.
