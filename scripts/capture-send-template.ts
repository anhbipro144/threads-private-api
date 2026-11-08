import { ThreadsTextSendAttempt, type ThreadsTextSendCapture } from '../src/threads-dm-send.ts';
import type { ThreadListPage, ThreadsReadRequest } from '../src/threads-dm-read.ts';

export const SEND_TEMPLATE_PLACEHOLDER = 'Captured plain-text template';

/** Validate in memory; never send or return the owner's typed text. */
export function captureSendTemplate(request: ThreadsReadRequest, inbox: ThreadListPage, username: string, threadId: string):
  { send: ThreadsTextSendCapture } | { reason: 'sendTemplateUnusable' | 'senderUnconfirmed' } {
  const senderFbid = inbox.threads.flatMap(chat => chat.members).find(member => member.username === username)?.id;
  if (!senderFbid) return { reason: 'senderUnconfirmed' };
  try {
    new ThreadsTextSendAttempt({ capture: { ...request, senderFbid }, text: SEND_TEMPLATE_PLACEHOLDER });
    const form = new URLSearchParams(request.body);
    const variables = JSON.parse(form.get('variables')!);
    if (variables.thread_fbid !== threadId) return { reason: 'sendTemplateUnusable' };
    variables.text_body = { sensitive_string_value: SEND_TEMPLATE_PLACEHOLDER };
    form.set('variables', JSON.stringify(variables));
    return { send: { headers: { ...request.headers }, body: form.toString(), senderFbid } };
  } catch { return { reason: 'sendTemplateUnusable' }; }
}
