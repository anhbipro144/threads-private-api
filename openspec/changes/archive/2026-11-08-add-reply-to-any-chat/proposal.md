# Proposal

## Why

The SDK can send a text or a quote reply, but only into the one chat whose send form
was captured, and the owner's capture command never saves a send form. So a host such
as Shop-AI cannot reply from a saved session at all. Replies are the next rollout step
after read-only receiving (`docs/shop-ai-integration.md`, rollout step 3).

## What Changes

- `ThreadsTextSendAttempt` takes an optional `threadId`, so one captured send form
  replies in any chat of that account. Swapping `thread_fbid` was reproduced live once
  (E15, `E14-REPLY-20261107`). Quote replies (`replyToMessageId`) work the same way in
  the chosen chat.
- `pnpm capture-session` gains an opt-in send step: the capture tab opens a test chat,
  the owner or an authorized agent types and sends one plain text message in that
  tab, and the command only observes that request as the send template. Nothing is saved if the send is not seen
  or is not a plain text send.
- The saved template carries no message text: the typed text is replaced by a
  placeholder before saving.
- The shop's messaging sender ID is taken from the capture's inbox read: the member
  whose username is the captured account.
- After saving, the command checks the send template the same way it checks reading
  and receiving, without sending anything.
- One controlled live run, within the owner's account and chat permissions, confirms
  capture plus a reply and a quote reply in a chat other than the captured one.

Not in this change: photo replies, the Shop-AI wiring (composer, API route, drafts),
AI-sent replies (D7 is open), capturing a mark-read form, and any retry of an
uncertain send.

## Capabilities

### New Capabilities

- `dm-send`: sending a message as the shop's account from a captured template: which
  chats it may target, quote replies, the single-attempt rule and how an uncertain
  outcome is reported.
- `session-capture`: the owner-run capture of one account's session into a private
  file: what it records, what it refuses, and how it proves the file works.

### Modified Capabilities

None. The project has no specs yet.

## Impact

- Code: `src/threads-dm-send.ts` (`threadId` option), `scripts/capture-session.ts`
  (send step, placeholder text, sender ID), `src/threads-session-file.ts` (only if the
  stored `send` shape needs validating on load).
- Tests: `tests/unit/threads-dm-send.test.ts`, `tests/unit/threads-session-file.test.ts`.
- Docs: `README.md`/usage guide for the capture flag, `docs/experiments.md` for the
  live run, `docs/session-recovery.md`.
- Public API: one new optional field; existing callers are unchanged.
- Live traffic: one message sent in the capture tab by the owner or an authorized
  agent per capture with the send step, plus the test messages of the live run,
  all within the owner's account and chat permissions. The command never sends.
