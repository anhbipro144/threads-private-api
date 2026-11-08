# Changelog

## Unreleased

- `ThreadsTextSendAttempt.threadId` targets another existing chat from one captured
  plain-text template, including quote replies. Omit it to keep the captured chat;
  empty IDs are refused and acknowledgements must match the chosen chat.
- `pnpm capture-session --with-send --thread <chat id>` waits up to 3 minutes for one
  plain text sent in the capture tab by the owner or an authorized agent, validates
  the observed send template and saves it with a
  placeholder instead of the message text. Missing or unusable sends save nothing;
  `sendTemplateUsable` checks the loaded template without sending.
- `saveThreadsSession` / `loadThreadsSession` keep one capture per account in a private file
  (mode 0600, owner-only directory, no links). `pnpm capture-session` (repository only, not
  in the package) captures it from the owner's logged-in Chrome and checks it with one read
  and one connection. By default it captures reading and receiving; sending is opt-in,
  and mark-read capture is not included.
- `ThreadsDmInbox` replaces a dropped receiver with capped backoff, using a host-supplied
  `getSession()`, runs a host `reconcile()` after each reconnect, and reports `live`,
  `reconnecting`, `needs-owner`, `failed` and `stopped`. It skips messages it already delivered
  when a new connection replays them, and accepts `seenMessageIds`.
- `ThreadsIncomingOptions.threadId` is optional; without it the receiver delivers every chat
  on the connection (E23). `DmChange` adds `threadFbid`.
- `ThreadSummary` adds `members` (`ThreadMember`: `id`, `username`, `name`, `avatarUrl`) and
  `unread`, read from the inbox list (E12, E21). Breaking only for code that builds
  `ThreadSummary` values itself.
- `DmMessage` is now a union: `kind: 'text'` (with `content`) or `kind: 'unsupported'`
  (ID, sender and time only). Non-text messages no longer fail a read or stop a receiver.
  Breaking for code that reads `content` without checking `kind`.
- Receiver delivers callbacks one at a time, in order. `callback-failed` errors carry
  `messageId`. The 10,000-ID dedupe set evicts the oldest ID instead of stopping.
- `DmMessage` adds `kind: 'image'` (`images` with URL and size) and `kind: 'shared-post'`
  (`postId`, `ownerId`, `caption`), checked live in reads and the receiver (E11).
  Live links and other kinds stay `unsupported`. Reads return links as `text`.
- `ThreadsImageSendAttempt` sends one photo: upload, then media send, single attempt.
  `ThreadsImageUploadError` means nothing was sent. Checked live once (E17).
- `ThreadsTextSendAttempt` takes `replyToMessageId` for quote replies; reads return
  `repliedToMessageId`. Checked live once each (E18).
- `ThreadsDmIncoming` takes `onChange` for reactions, reaction removals, edits, unsends and
  reads in the conversation (`DmChange`). Reactions, removals and reads checked live once.
- `markThreadRead` marks a conversation read by replaying a captured mark-read form with
  `timestamp_ms` set to now. Checked live once. `threadId` marks another chat with the
  same form, checked live once (E21).

## 0.3.0-beta.1

- Package the typed reader, single-attempt text sender, HTTP handlers and incoming
  text receiver for Node 24 backend integration.
- Include bounded local duplicate suppression, explicit shutdown, session
  replacement and optional durable send-status recovery.
- Record controlled send/receive tests, 15-minute idle listening, manual gap
  recovery and receipt after a fresh manual connection.
- Add usage guides, runnable offline example, isolated bundle checks and GitHub
  release assets. No public npm publication.
- Bound reads with a 30-second request deadline, sanitize malformed JSON and
  transport/body failures, and reject invalid pacing/page limits before dispatch.

Beta compatibility checkpoint. Genuine expiry, automatic recovery and production
reliability are not established. A release authorizes no live messages.

## 0.2.0

Internal checkpoint for controlled sending, session lifecycle, status journaling
and message pagination. Not a public registry release.
