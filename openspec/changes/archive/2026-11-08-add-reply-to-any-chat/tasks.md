# Tasks

## 1. Reply into a chosen chat (`dm-send`)

- [x] 1.1 Add optional `threadId` to `ThreadsTextSendOptions` in `src/threads-dm-send.ts`, overriding `thread_fbid` after template validation and used for the acknowledgement check; refuse an empty `threadId` before any request. Verify with new cases in `tests/unit/threads-dm-send.test.ts`: the request goes to the named chat, no `threadId` keeps the captured chat, an empty ID makes no request, an echo naming the captured chat instead of the named one is an unknown outcome, and a quote plus `threadId` carries both.
- [x] 1.2 Document `threadId` in `README.md` (replace "The captured conversation is fixed") and add a `CHANGELOG.md` Unreleased entry; verify the README example type-checks via `pnpm typecheck` and `pnpm test`, `pnpm build` pass.

## 2. Send template in the owner capture (`session-capture`)

- [x] 2.1 Add a pure helper that turns one captured send request plus the first inbox page into a stored send template: require `WmiSlideTextMessageMutation` aimed at the opened chat, validate it by constructing `ThreadsTextSendAttempt` (no `send()`), replace the text with a fixed placeholder, and take `senderFbid` from the inbox member whose `username` is the captured account; return a value-free failure reason otherwise. Verify with synthetic offline tests: success, wrong chat, quote template, mention template, missing member, and the saved body not containing the original text.
- [x] 2.2 Wire `--with-send` into `scripts/capture-session.ts`: require `--thread`, open the capture tab in the foreground, print one prompt, wait up to 3 minutes for a new send request, use the 2.1 helper, save nothing on any failure, and after saving construct (never send) an attempt for another inbox chat and print `sendTemplateUsable`. Verify `pnpm typecheck`, and that a run without `--with-send` prints the same steps as before (usage line and a dry run of argument checks).
- [x] 2.3 Document the send step in `docs/session-recovery.md` (when to use it, that the owner or an authorized agent sends one message in the capture tab while the command only observes, what is saved, the error lines) and in `CHANGELOG.md`; verify the documented command line matches the script's usage line.

## 3. Controlled live check (owner-approved)

The checked steps below record the completed E25 run, including its owner-sent
capture and exact-message approval. Future runs follow the current account and
chat permissions in `AGENTS.md`; the operator may be the owner or an authorized
agent, and the capture command itself never sends.

- [x] 3.1 Before any live step, get the owner's written approval of the exact run list (D5): the owner's own capture message (shop to one test customer, in the agreed chat), one SDK text reply in the other test chat via `threadId`, and one SDK quote reply in that chat quoting the customer's latest message, each with exact text and count 1. Verify the approved list is recorded in chat, not in the repo.
- [x] 3.2 Run `pnpm capture-session --with-send` against the owner's Chrome; the owner sends their message themselves. Verify the printed steps include `sendTemplateUsable true` and that the saved file holds no typed text (check by a value-free script that prints only true/false).
- [x] 3.3 Send the two approved SDK messages, one attempt each, never retrying an unknown outcome. Verify each acknowledgement and one Node read per chat showing exactly one new item from the shop with the acknowledged message ID, and the owner's receipt check on the customer account.
- [x] 3.4 Record the run in `docs/experiments.md` (new ID, evidence level per step, no handles or texts) and update `docs/protocol-map.md` and the readiness plan's gap table for "Only one chat works per capture" and "Quote replies"; verify `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm verify:package` pass.

## Workflow follow-up

- 2026-11-08 completed: 3.2 passed. Both SDK sends in 3.3 acknowledged and each
  matched exactly one new item in its Node read, including the quote target.
  The owner independently confirmed both arrived on the receiving account.
  Do not resend them. Standing permission in `AGENTS.md` covers the main account;
  ask before operating either customer account. See E25 in `docs/experiments.md`.
- Review, then archive the change and sync `dm-send` and `session-capture` into `openspec/specs/`.
- Shop-AI wiring (composer, API route, durable send state) is a separate change in `tiemdosime-bot`.
