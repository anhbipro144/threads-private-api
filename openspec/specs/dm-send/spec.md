# dm-send Specification

## Purpose

Lets a host send a text reply as the shop's own Threads account, into any existing
chat of that account, from one captured send template, with at most one provider
request per message and no retry.

## Requirements

### Requirement: Reply into a chosen chat
A text send SHALL go to the chat the caller names. When the caller names no chat, it SHALL go to the chat inside the captured template, as before. The chat name SHALL be a nonempty ID; anything else is refused before any request.

#### Scenario: Reply in another chat with one template
- **WHEN** a host sends a text with a template captured in chat A and names chat B
- **THEN** exactly one provider request is made, addressed to chat B, with that text

#### Scenario: No chat named
- **WHEN** a host sends a text without naming a chat
- **THEN** the request is addressed to the chat inside the captured template

#### Scenario: Empty chat ID
- **WHEN** a host names an empty chat ID
- **THEN** the send is refused and no request is made

### Requirement: Quote reply in the chosen chat
When the caller passes a message ID to quote, the send SHALL quote that message in whichever chat the send targets. A quoted ID that is present but empty SHALL be refused before any request.

#### Scenario: Quote in another chat
- **WHEN** a host names chat B and a message ID read from chat B as the quote
- **THEN** the single request targets chat B and carries that message ID as the quoted message

#### Scenario: Empty quote ID
- **WHEN** a host passes an empty quote ID
- **THEN** the send is refused and no request is made

### Requirement: Only a plain text template is accepted
The SDK SHALL accept as a send template only a captured plain text send into an existing chat: no recipients list, quote, forward, mention or silent flag in the template itself. Any other template SHALL be refused before any request.

#### Scenario: Template captured from a quote reply
- **WHEN** the captured template already quotes a message
- **THEN** the send is refused before any request

### Requirement: Acknowledgement must match the sent message
A send SHALL count as acknowledged only when the provider's reply echoes the targeted chat, the shop's sender ID, the fresh offline ID and the exact text. An acknowledged send SHALL return the provider's message ID and timestamp.

#### Scenario: Echo from another chat
- **WHEN** the provider's reply names a chat other than the one targeted
- **THEN** the outcome is reported as unknown, not acknowledged

#### Scenario: Matching echo
- **WHEN** the reply echoes the targeted chat, sender, offline ID and text
- **THEN** the host receives the provider's message ID and timestamp

### Requirement: One attempt, never retried
Each send SHALL make at most one provider request. Any failure after the request starts SHALL be reported as an unknown outcome that tells the host to check the chat and never retry, and SHALL flag a session rejection as needing the owner. Errors SHALL carry no session values or message text.

#### Scenario: Second call on the same attempt
- **WHEN** a host calls send again on an attempt that already ran
- **THEN** it is refused without a request

#### Scenario: Network failure after the request starts
- **WHEN** the connection fails after the request was sent
- **THEN** the host gets an unknown outcome, and nothing is sent again

#### Scenario: Session rejected
- **WHEN** the provider answers 401 or 403
- **THEN** the host gets an unknown outcome marked as needing the owner to reconnect
