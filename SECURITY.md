# Security and private data

Use this SDK only in the owner-only backend. Never expose captured cookies,
forms, private URLs, raw provider traffic or message contents in frontend code,
logs, issues, pull requests or release assets. The SDK does not authorize access
to other accounts or conversations.

Report suspected security problems privately to the repository owner through
GitHub's private security reporting when enabled, or contact the owner privately
before opening an issue. Include package/Node versions and a minimal synthetic
reproduction. Do not attach live captures.

Stop at rejected sessions and challenges; the owner authenticates. Reconcile
unknown send outcomes with the recipient and never retry them. Unsupported
incoming data stops the connection rather than bypassing validation.
