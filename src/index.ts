/**
 * Read-only DM reads (listThreads/listMessages) are REPRODUCED and exported.
 * A single controlled text send is VERIFIED in Node with independent B receipt.
 */
export const researchStatus = 'read-reproduced-send-verified-controlled' as const;

export { createFileThreadsSendJournal } from './threads-send-journal.ts';
export type { ThreadsSendJournal, ThreadsSendJournalStatus } from './threads-send-journal.ts';

export { createThreadsSendHandler } from './threads-send-handler.ts';
export type { ThreadsSendConversation, ThreadsSendHandlerOptions } from './threads-send-handler.ts';

export { ThreadsTextSendAttempt, ThreadsSendOutcomeUnknownError } from './threads-dm-send.ts';
export type {
  ThreadsTextSendCapture,
  ThreadsTextSendOptions,
  ThreadsTextSendAcknowledgement,
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
  DmMessage,
  PageInfo,
  ThreadListPage,
  MessageListPage,
  ThreadsReadRequest,
  CapturedForms,
  ThreadsDmReadSession,
  ThreadsDmReaderOptions,
  ThreadsSessionStatus,
} from './threads-dm-read.ts';
