/**
 * Read-only DM reads (listThreads/listMessages) are REPRODUCED and exported.
 * No send client is exported: the send path is only observed, not reproduced in Node.
 */
export const researchStatus = 'read-reproduced-send-unverified' as const;

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
} from './threads-dm-read.ts';
