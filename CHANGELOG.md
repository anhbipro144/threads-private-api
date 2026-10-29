# Changelog

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
