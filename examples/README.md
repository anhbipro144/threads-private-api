# Examples

Use Node 24.22.1+ and the release bundle. Examples contain synthetic values only.

## No-network demo

From a built checkout: `node examples/offline-demo.mjs`.

From an installed package:

```sh
node node_modules/threads-private-api/examples/offline-demo.mjs
```

It injects a synthetic transport, reads an invented conversation/message and
prints counts only. It cannot contact Threads or send a message.

For host integration, use the [quickstart](../README.md),
[Direct-message guide](../docs/usage-guide/direct-messages.md),
[incoming example](../docs/incoming-sdk.md) and
[HTTP contracts](../docs/website-send-handler.md) with backend-supplied captures.
No password login, cookie-export command, bulk action or unreviewed send command
is included. Each real message needs exact approval and independent receipt.
