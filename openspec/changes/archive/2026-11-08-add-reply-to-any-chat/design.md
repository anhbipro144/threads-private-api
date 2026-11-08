# Design

## Context

See `proposal.md` for why. Current state:

- `ThreadsTextSendAttempt` (`src/threads-dm-send.ts`) validates a captured
  `WmiSlideTextMessageMutation` form, swaps in the text, a fresh offline ID and an
  optional quote, and sends once to the `thread_fbid` inside the form.
  `markThreadRead` in the same file already takes `threadId` and overrides
  `thread_fbid`.
- `ThreadsStoredSession.send` exists in `src/threads-session-file.ts`, but
  `scripts/capture-session.ts` never fills it. The capture opens its own tab with
  Chrome DevTools, opens a chat (optionally `--thread`), and picks GraphQL requests
  out of the tab's network log by friendly name.
- Evidence: one form set served a second chat by swapping `thread_fbid` only (E15,
  `E14-REPLY-20261107`, REPRODUCED once). Quote replies were REPRODUCED
  (`E18-QUOTE-REPLY-20261107`). Shop-AI's identity check (2026-11-08) found the shop's
  inbox member `id` equal to `senderFbid` on the shop's own messages in both test chats.
- The send `doc_id` changed between 2026-10-28 and 2026-11-07 (E14).

## Goals / Non-Goals

**Goals:**

- One saved session file is enough to reply in any chat of that account.
- The send template always comes from a request the browser really made.

**Non-Goals:**

- Changing `createThreadsSendHandler` or the send journal. The handler still binds a
  capture to a configured chat; hosts that need any-chat replies use the attempt
  directly and own durable send state, as `docs/shop-ai-integration.md` plans.
- Renewing or refreshing a send template without the owner.

## Decisions

### 1. Get the template from an observed send in the capture tab (option A)

During capture, with the send step requested, the owner or an authorized agent
types and sends one plain text in the capture tab, and the command only observes
that request. This operator must have permission for the account and chat: under
`AGENTS.md`, the agent may operate as main test account A in its two agreed chats;
operating as customer B or C requires asking the owner. The command itself never
types, clicks Send or sends a message.

- **Chosen because** it is observed rather than built. Each capture picks up the
  current `doc_id` and form fields on its own, so a `doc_id` change cannot leave a stale
  hard-coded value. The owner chose it on 2026-11-08.
- **Alternative B, build the form** from the message-list form plus the `doc_id` read
  from the page's public JavaScript. This was REPRODUCED once (`E14-REPLY-20261107`)
  and needs no message. It is not chosen now: it relies on finding the `doc_id` in
  bundled code, and every capture would carry an untested template. It is the fallback
  if captures turn out to be frequent (E20).
- **Rejected C, intercept and block** the browser's send. That works against the
  client, and the UI may retry or show a failed send.

### 2. `threadId` on `ThreadsTextSendAttempt`, mirroring `markThreadRead`

Add an optional `threadId` that overrides `thread_fbid` after validation. Use it for
the acknowledgement check as well.

- **Why:** the same pattern already exists for mark-read and keeps one class.
- **Not chosen:** a new `sendText(threadId, …)` helper. It would duplicate the
  validation and only rename the class, and the target API in the readiness plan is
  illustrative until a channel object exists.

### 3. Capture flow with the send step

`pnpm capture-session --username <u> --out <file> --thread <test chat> --with-send`.
`--with-send` requires `--thread`.

- **Tab.** The capture tab opens in the foreground, so the operator can type there; without
  the step it stays in the background.
- **Prompt and wait.** After the existing reads, the command prints one line asking the
  operator to send one plain text message in the opened chat, then waits up to 3 minutes.
  It looks only at network requests not seen before.
- **Accepting the request.** It takes the first `WmiSlideTextMessageMutation` request.
  The request must target `--thread`; otherwise the operator sent elsewhere and nothing is
  saved.
- **Template check.** It must pass `ThreadsTextSendAttempt`'s own validation
  (construct only, never `send()`). This rejects a quote or a mention.
- **What is saved.** `text_body.sensitive_string_value` is replaced with a fixed
  placeholder before saving. Headers come from the send request, with the same
  dropped headers as the other forms.
- **Sender ID.** It is the `id` of the inbox member whose `username` equals
  `--username`, from the capture's existing inbox read. This is the same rule Shop-AI's
  `threads:link` uses. With no match, nothing is saved.
- **Check after saving.** Load the file and construct an attempt with `threadId` set to
  another inbox chat (the captured one when the inbox has only one). Report
  `sendTemplateUsable`; make no request.

### 4. Printed output stays value-free

As today, the command prints only step names and booleans or counts. The operator's
text exists only in Chrome's network log for the capture tab, which is closed at the
end, and in the command's memory until the placeholder replaces it.

## Risks / Trade-offs

- **[Risk] Every capture with the send step sends one real message.**
  → Opt-in flag; the operator sends it into an agreed test chat. Without the flag, the
  capture is unchanged.
- **[Risk] Swapping `thread_fbid` was reproduced only once, from a form built by hand,
  not from a browser-captured one.**
  → The live run in the tasks repeats it with a captured template, and the docs record
  the result.
- **[Risk] A host could name a chat the shop has no business writing to.**
  → The SDK sends only within the account's own chats, as the provider allows. Choosing
  the chat is the host's job; Shop-AI must target only linked conversations. The rule
  against messaging people who have not written first stays a host policy.
- **[Risk] The template expires with the session.**
  → The existing behaviour holds: 401/403 gives an unknown outcome needing the owner,
  and there is no retry.
- **[Trade-off] Many-to-one.** One template serves every chat, so a bad template breaks
  replies everywhere at once. This is accepted: re-capturing fixes all of them together,
  which matches the readiness plan's "replace session updates everything together".

## Migration Plan

No data migration. `threadId` is optional, so existing callers are unchanged. Old
session files without `send` still load. Rollback is reverting the commit.

## Open Questions

- How long a captured send template keeps working (part of E20). It does not change
  this design, only how often the owner re-captures.
