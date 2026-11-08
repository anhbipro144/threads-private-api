# Spec Delta

## Purpose

Lets the owner save one Threads account's session from their own logged-in Chrome into
a private file that a host can read, receive and reply with, without the SDK ever
logging in or sending on its own.

## ADDED Requirements

### Requirement: Opt-in send template from an authorized operator's message
An operator is the owner or an agent authorized by the owner to operate that account and chat. When a send template is requested, the capture command SHALL open the named test chat and wait a bounded time for the operator to send one message in that tab. It SHALL record that request as the send template. The capture command SHALL NOT type, click send or send any message itself.

#### Scenario: Authorized operator sends one message
- **WHEN** the owner or an authorized agent runs the capture with the send step and sends one plain text in the opened chat
- **THEN** the saved session holds a send template from that request

#### Scenario: Send step not requested
- **WHEN** the operator runs the capture without the send step
- **THEN** no message is waited for and the saved session has no send template, as today

### Requirement: Nothing saved when the send template is missing or unusable
With the send step, the capture SHALL save nothing when no send is seen within the wait, or the seen request is not a plain text send into an existing chat (for example a quote, mention or photo).

#### Scenario: Operator does not send in time
- **WHEN** the wait ends without a send request
- **THEN** the capture reports the send template as missing and saves no file

#### Scenario: Operator sends a quote reply
- **WHEN** the captured send quotes a message
- **THEN** the capture reports it as unusable and saves no file

#### Scenario: Operator sends in a different chat
- **WHEN** the captured send targets a chat other than the one the capture opened
- **THEN** the capture reports it as unusable and saves no file

### Requirement: Saved template holds no message text
The send template SHALL be saved with the operator's typed text replaced by a fixed placeholder. The capture command SHALL NOT print or log the text, the form or any session value.

#### Scenario: Inspecting the saved file
- **WHEN** a capture with the send step has saved its file
- **THEN** the file does not contain the text the operator typed

### Requirement: Sender ID from the account's own inbox entry
The template's sender ID SHALL be the inbox member ID whose username equals the captured account. When no such member is found on the first inbox page, the capture SHALL save nothing.

#### Scenario: Account not found among chat members
- **WHEN** the first inbox page has no member with the captured username
- **THEN** the capture reports the sender ID as unconfirmed and saves no file

### Requirement: Saved template is checked without sending
After saving, the capture SHALL load the file and confirm the send template is accepted for another inbox chat (the captured one when it is the only chat), without making any send request.

#### Scenario: Check after saving
- **WHEN** a file with a send template is saved
- **THEN** the capture reports the template as usable, and no message other than the operator's one message was sent
