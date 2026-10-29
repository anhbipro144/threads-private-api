# Direct messages

## Read

Create `ThreadsDmReader` with a caller-supplied session, or adapt exact observed
forms/headers with `sessionFromCapturedForms()`. `listThreads()` and
`listMessages(threadId)` return one page. Render private results only to the owner.

Older messages need the separate captured `messagePaginationBody` for the same
conversation. Its Relay node ID differs from `thread_fbid`; preserve that ID.
Use `listMessages(threadId, cursor)` or bounded `allMessages()`. Missing pagination
configuration fails before dispatch. Mailbox pagination needs its own observed
cursor variable and remains unverified live. Never guess it from message queries.

Reads are serialized with a five-second default interval, no automatic retry and
a cap on all-pages helpers. Use on-demand reads rather than bulk traversal/polling.

## Send

`new ThreadsTextSendAttempt({ capture, text })` prepares without sending. Capture
contains the exact observed form/headers and messaging sender ID, which differs
from the form actor `av`. Recipient/conversation scope remains fixed.

Review exact sender, recipient and text and obtain approval for one send before
`send()`. Repeated/concurrent calls on that attempt cannot resend. Echoes in the
acknowledgement are validated; check receipt independently on the receiving account.

`ThreadsSendOutcomeUnknownError` consumes the attempt: delivery may have happened.
Do not retry or create a replacement attempt for that message. The basic guard
is in memory; the send handler's optional journal retains consumed status across
restarts. See [recovery](../session-recovery.md). This is not server deduplication.

## Backend handlers

`createThreadsReadHandler()` and `createThreadsSendHandler()` expose Web
`Request` / `Response` functions; they start no server. Adapt them to Fastify,
Next or another backend and implement the required owner-access callback using
the host's existing access boundary. The library adds no password prompt.

See [read routes](../website-read-handler.md) and [draft/send/confirm routes](../website-send-handler.md).
Keep session material in the API, never the frontend. Website integration is
separate from installing this library.
