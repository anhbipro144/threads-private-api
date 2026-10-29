# threads-private-api

Unofficial Node.js / TypeScript SDK for reading the owner's Threads conversations,
sending reviewed text replies and receiving live text updates.

**Beta for controlled owner-account integration.** This uses the observed web
client interface, not an official or supported Meta API. Authentication comes
from the owner's browser. The SDK does not log in, bypass challenges, renew
credentials or retry uncertain sends.

Requires **Node 24.22.1+ within Node 24**, ESM and current captured session state.
No runtime dependencies. Chrome, REA and TypeScript are development tools and
are not installed with the release bundle.

## Installation

Use an authorized GitHub account to download the private release, then install
the versioned tarball into your website's backend:

```sh
gh release download v0.3.0-beta.1 --repo anhbipro144/threads-private-api \
  --pattern 'threads-private-api-*.tgz' --pattern 'SHA256SUMS' --dir ./vendor
cd vendor
shasum -a 256 -c SHA256SUMS
cd ..
pnpm add ./vendor/threads-private-api-0.3.0-beta.1.tgz
```

Distribution is a GitHub release asset, not public npm. Install the `.tgz`;
direct Git-checkout dependencies are not the supported release path. Keep access
tokens out of dependency URLs.

## Quick start

```ts
import { ThreadsDmReader, sessionFromCapturedForms } from 'threads-private-api';

// Values come from your backend's current owner-authenticated capture.
const reader = new ThreadsDmReader({
  session: sessionFromCapturedForms({
    threadListBody: capturedInboxForm,
    messageListBody: capturedMessageForm,
    messagePaginationBody: capturedOlderPageForm, // optional, same conversation
    headers: capturedHeaders,
  }),
});
const page = await reader.listMessages(agreedConversationId);
renderOwnerConversation(page.messages); // never log private messages
```

Keep session state in the backend and outside Git. The owner handles sign-in and
challenges in their existing browser. See [sessions/errors](docs/usage-guide/sessions-and-errors.md).

## Typical tasks

| Task | API |
| --- | --- |
| Read inbox/conversation | `ThreadsDmReader.listThreads()`, `.listMessages()` |
| Older messages | Captured pagination form, cursor calls, bounded `.allMessages()` |
| Prepare a reviewed reply | `new ThreadsTextSendAttempt({ capture, text })` |
| Send once after approval | `attempt.send()`; never retry an unknown outcome |
| Receive live text | `ThreadsDmIncoming.start()`, `.stop()`, `.closed` |
| Owner-only HTTP endpoints | `createThreadsReadHandler()`, `createThreadsSendHandler()` |
| Retain send outcome status across restarts | `createFileThreadsSendJournal()` |

### Text replies

```ts
import { ThreadsTextSendAttempt } from 'threads-private-api';

const attempt = new ThreadsTextSendAttempt({ capture: capturedSend, text: reviewedText });
// Constructor prepares only. Review sender, recipient and text; approve one send.
const acknowledgement = await attempt.send();
```

The captured conversation is fixed and acknowledgement fields checked. Each live
message needs approval for exact sender, recipient, content and count. Check
receipt independently. `ThreadsSendOutcomeUnknownError` means delivery may have
happened: never retry or construct another attempt for that uncertain message.
See [Direct messages](docs/usage-guide/direct-messages.md).

### Live receiving

```ts
import { ThreadsDmIncoming } from 'threads-private-api';

const incoming = new ThreadsDmIncoming({
  session: capturedIncomingSession,
  threadId: agreedConversationId,
  seenMessageIds: page.messages.map(message => message.messageId),
  onMessage: message => updateOwnerInbox(message),
});
try {
  await incoming.start();
  await incoming.closed;
} finally {
  incoming.stop(); // also call from the host's shutdown/disconnect path
}
```

Only the configured chat's text events are returned. Reconnection needs fresh
owner-supplied setup and reader reconciliation. No automatic login, reconnect
or resnapshot. See [incoming API and limits](docs/incoming-sdk.md).

## Documentation and examples

- [Runnable examples](examples/README.md), including a no-network demo.
- [Usage guide](docs/usage-guide/README.md).
- [Sessions/errors](docs/usage-guide/sessions-and-errors.md).
- [Compatibility/validation](docs/usage-guide/compatibility.md).
- [Durable send status and session replacement](docs/session-recovery.md).
- [Read HTTP contract](docs/website-read-handler.md) / [send HTTP contract](docs/website-send-handler.md).
- [Changelog](CHANGELOG.md), [contributing](CONTRIBUTING.md), [security](SECURITY.md).

## Validation and limits

Controlled tests reproduced reads with Chrome closed, older-message pages, one
independently confirmed Node send and SDK incoming events matched to separate
reads. A 15-minute idle check, manual gap recovery and receipt after a fresh manual
connection passed. Automated tests use synthetic data and make no live requests.

These bounded results do not establish production reliability. Real session
expiry, automatic recovery, browser-closed push, general duplicate guarantees,
media, reactions, arbitrary recipients and mailbox pagination remain unverified
or unsupported. Review current platform terms and compatibility before production.

## Development and releases

See [CONTRIBUTING.md](CONTRIBUTING.md). Releases contain compiled JavaScript,
declarations, consumer guides and examples. Research captures/browser tooling
are excluded. The actual tarball is installed and checked as an isolated consumer
before publication. No live account tests run in CI.

Package layout follows the installation / quickstart / usage-guide / examples /
changelog conventions of [instagrapi](https://github.com/subzeroid/instagrapi),
adapted to Node. No code or protocol behavior was copied. Internal investigation
setup is in the repository's [research setup](https://github.com/anhbipro144/threads-private-api/blob/main/docs/research-setup.md)
and [agent handoff](https://github.com/anhbipro144/threads-private-api/blob/main/docs/agent-handoff.md).

## License

Private, unlicensed distribution for the owner's integration. No open-source
license is granted; dependency licenses remain their own.
