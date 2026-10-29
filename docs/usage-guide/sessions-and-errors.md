# Sessions and errors

The owner signs in and handles challenges in their existing browser. The host
obtains current observed forms, headers and incoming setup through a separately
authorized capture workflow. Keep them in backend memory and outside Git. The
SDK does not log in, save cookies, guess protocol state or renew credentials.

| Signal | Host action |
| --- | --- |
| `ThreadsAuthRequiredError` / reader `reconnect-required` | Pause reads, collect fresh owner state and call `replaceSession()` |
| `ThreadsSendOutcomeUnknownError` | Keep the attempt consumed, check the recipient, never retry |
| `reconnectRequired` on uncertain send | Replace captures/handler for future new drafts too |
| `ThreadsIncomingError` / incoming `failed` | Stop, reconcile with a reader, capture fresh setup and create a new instance |
| Explicit incoming `stop()` | Clean shutdown; no automatic reconnection |

Never log provider bodies, session forms or private URLs. SDK errors are sanitized,
but the host must protect its own logs. Incoming callback rejection stops the
receiver. Watch `incoming.closed` to show connection status.

These components have separate lifecycles: replacing reader state does not update
existing senders/receivers. Unknown sends remain consumed after reconnect.
Genuine service expiry and automatic recovery are unverified. See
[compatibility](compatibility.md) and [recovery setup](../session-recovery.md).
