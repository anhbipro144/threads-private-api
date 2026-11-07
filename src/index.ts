/**
 * Read-only DM reads (listThreads/listMessages) are REPRODUCED and exported.
 * A single controlled text send is VERIFIED in Node with independent B receipt.
 */
export const researchStatus = 'read-reproduced-send-verified-controlled' as const;

export { ThreadsDmIncoming, ThreadsIncomingError } from './threads-dm-incoming.ts';
export type { ThreadsIncomingSession, ThreadsIncomingOptions, ThreadsIncomingState, DmChange } from './threads-dm-incoming.ts';

export { createFileThreadsSendJournal } from './threads-send-journal.ts';
export type { ThreadsSendJournal, ThreadsSendJournalStatus } from './threads-send-journal.ts';

export { createThreadsSendHandler } from './threads-send-handler.ts';
export type { ThreadsSendConversation, ThreadsSendHandlerOptions } from './threads-send-handler.ts';

export {
  ThreadsTextSendAttempt, ThreadsSendOutcomeUnknownError, ThreadsImageSendAttempt, ThreadsImageUploadError, THREADS_UPLOAD_ENDPOINT, markThreadRead,
} from './threads-dm-send.ts';
export type {
  ThreadsTextSendCapture,
  ThreadsTextSendOptions,
  ThreadsTextSendAcknowledgement,
  ThreadsImageSendOptions,
  ThreadsImageSendAcknowledgement,
  ThreadsMarkReadOptions,
} from './threads-dm-send.ts';

export { createThreadsReadHandler } from './threads-read-handler.ts';
export type { ThreadsReadHandlerOptions } from './threads-read-handler.ts';

export {
  ThreadsDmReader,
  ThreadsAuthRequiredError,
  sessionFromCapturedForms,
  THREADS_GRAPHQL_ENDPOINT,
  parseThreadList,
  parseMessageList,
  parseGraphqlEnvelope,
} from './threads-dm-read.ts';
export type {
  ThreadSummary,
  ThreadMember,
  DmMessage,
  TextDmMessage,
  DmImage,
  ImageDmMessage,
  SharedPostDmMessage,
  UnsupportedDmMessage,
  PageInfo,
  ThreadListPage,
  MessageListPage,
  ThreadsReadRequest,
  CapturedForms,
  ThreadsDmReadSession,
  ThreadsDmReaderOptions,
  ThreadsSessionStatus,
} from './threads-dm-read.ts';
