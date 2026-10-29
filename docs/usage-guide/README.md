# Usage guide

Server-side ESM library for the owner's controlled Threads chats. The installed
bundle has no runtime dependency on Chrome, REA or TypeScript. Current session
material comes from a separately authorized owner-browser capture workflow;
automatic capture/login is not included.

- [Direct messages and backend handlers](direct-messages.md)
- [Sessions and errors](sessions-and-errors.md)
- [Compatibility](compatibility.md)
- [Incoming events](../incoming-sdk.md)
- [Recovery and send journal](../session-recovery.md)
- [Runnable examples](../../examples/README.md)

Configure agreed conversation IDs on the server. Enforce the host's real
owner-access boundary, such as device-restricted Tailscale, in handler callbacks.
