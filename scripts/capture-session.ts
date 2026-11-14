// Owner-run capture: attaches to the owner's open, logged-in Chrome, reads one Threads session in
// memory and saves it to a private file. It never logs in, answers a challenge or prints session values.
import { parseArgs } from 'node:util';
import { connectChrome } from './chrome-session.ts';
import { ThreadsDmIncoming, ThreadsDmReader, ThreadsTextSendAttempt, loadThreadsSession, markThreadRead, saveThreadsSession, sessionFromCapturedForms } from '../src/index.ts';
import type { ThreadsIncomingSession, ThreadsTextSendCapture } from '../src/index.ts';
import { captureSendTemplate, SEND_TEMPLATE_PLACEHOLDER } from './capture-send-template.ts';

const { values: { username, out, thread, 'with-send': withSend, 'with-mark-read': withMarkRead } } = parseArgs({ options: { username: { type: 'string' }, out: { type: 'string' }, thread: { type: 'string' }, 'with-send': { type: 'boolean' }, 'with-mark-read': { type: 'boolean' } } });
if (!username || !/^[A-Za-z0-9._]+$/.test(username) || !out || (thread !== undefined && !/^\d+$/.test(thread)) || (withSend && !thread)) {
  console.error('usage: pnpm capture-session --username <shop account> --out <absolute file> [--thread <chat id to open>] [--with-send (requires --thread)] [--with-mark-read (the opened chat must be unread)]');
  process.exit(2);
}
const step = (label: string, value?: unknown) => console.log(value === undefined ? label : `${label} ${JSON.stringify(value)}`);
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Records the first packets the page sends on its Lightspeed connection.
const hook = `(() => {
  const Native = window.WebSocket, sockets = window.__threadsCapture = [], send = Native.prototype.send;
  Native.prototype.send = function (data) {
    try {
      const socket = sockets.find(entry => entry.ws === this);
      if (socket && socket.packets.length < 12 && typeof data !== 'string') {
        const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
        socket.packets.push(btoa(String.fromCharCode(...bytes)));
      }
    } catch {}
    return send.call(this, data);
  };
  window.WebSocket = new Proxy(Native, { construct(target, args, next) {
    const ws = Reflect.construct(target, args, next);
    if (String(args[0]).includes('/ws/lightspeed')) sockets.push({ ws, url: String(args[0]), packets: [] });
    return ws;
  } });
})();`;

const mcp = await connectChrome();
type ToolResult = { isError?: boolean; content: { text?: string }[] };
const call = async (name: string, args: object, timeoutMs = 60_000): Promise<string> => {
  const request = () => mcp.request('tools/call', { name, arguments: args }, timeoutMs) as Promise<ToolResult>;
  // The DevTools server sometimes prints a non-JSON line, which fails the pending call; retry once.
  const result = await request().catch((error: Error) => { if (error.message !== 'Invalid MCP JSON') throw error; return request(); });
  if (result.isError) throw new Error(`Chrome step failed: ${name}`);
  return result.content.map(part => part.text ?? '').join('\n');
};
const evaluate = async (pageId: number, fn: string) => JSON.parse((await call('evaluate_script', { pageId, function: fn })).match(/```json\n([\s\S]*?)\n```/)?.[1] ?? 'null');
const ids = (text: string) => [...text.matchAll(/^(\d+):/gm)].map(match => match[1]);

function parseRequest(text: string) {
  const section = (name: string) => text.match(new RegExp(`### ${name}\\n([\\s\\S]*?)(?=\\n### |$)`))?.[1];
  const headers: Record<string, string> = {};
  for (const line of (section('Request Headers') ?? '').split('\n')) {
    const match = line.match(/^- ([^:]+):\s?(.*)$/);
    if (match) headers[match[1]!.toLowerCase()] = match[2]!;
  }
  for (const name of ['content-length', 'accept-encoding', 'host']) delete headers[name];
  return { headers, body: section('Request Body')?.trim() ?? '' };
}

let threadListBody: string | undefined, messageListBody: string | undefined, requests: ReturnType<typeof parseRequest> | undefined;
let incoming: ThreadsIncomingSession | undefined;
let send: ThreadsTextSendCapture | undefined;
let markRead: ReturnType<typeof parseRequest> | undefined;
const MARK_READ = 'WmiSlideThreadMutationsMarkReadMutation';
await mcp.initialize();
try {
  const known = new Set(ids(await call('list_pages', {}, 180_000)));
  const pageId = Number(ids(await call('new_page', { url: 'about:blank', background: !withSend })).find(id => !known.has(id)));
  if (!Number.isInteger(pageId)) throw new Error('cannot identify the capture tab');
  try {
    await call('navigate_page', { pageId, type: 'url', url: 'https://www.threads.com/messages', initScript: hook, timeout: 45_000 });
    await delay(5_000);
    const account = await evaluate(pageId, `() => !!document.querySelector('a[href="/@${username}"]') || document.documentElement.innerHTML.includes('"username":"${username}"')`);
    step('accountConfirmed', account);
    if (!account) throw new Error('the open Threads tab is not logged in as that account; log in yourself, then run again');

    const seen = new Set<string>();
    const grab = async (match: (form: URLSearchParams) => boolean) => {
      for (let attempt = 0; attempt < 8; attempt++) {
        await delay(2_500);
        const listing = await call('list_network_requests', { pageId, resourceTypes: ['xhr', 'fetch'] });
        for (const reqid of [...listing.matchAll(/reqid=(\d+) POST \S*graphql\S*/g)].map(match => match[1]!)) {
          if (seen.has(reqid)) continue;
          seen.add(reqid);
          const request = parseRequest(await call('get_network_request', { pageId, reqid: Number(reqid) }));
          // The page marks an unread chat read while other forms are awaited; keep that form when it passes by.
          if (withMarkRead && !markRead && new URLSearchParams(request.body).get('fb_api_req_friendly_name') === MARK_READ) markRead = request;
          if (match(new URLSearchParams(request.body))) return request;
        }
      }
    };
    const click = (selector: string) => evaluate(pageId, `() => { const a = document.querySelector(${JSON.stringify(selector)}); if (a) a.click(); return !!a; }`);
    const name = (form: URLSearchParams) => form.get('fb_api_req_friendly_name');
    const folder = (form: URLSearchParams) => { try { return JSON.parse(form.get('variables') ?? '{}').folder; } catch { return undefined; } };

    // Opening a chat in the browser marks it read, as it does for the owner.
    if (!await click(thread ? `a[href*="/messages/t/${thread}"]` : 'a[href^="/messages/t/"]')) throw new Error('no chat to open in the inbox');
    messageListBody = (await grab(form => name(form) === 'BarcelonaMessageListContainerQuery'))?.body;
    step('messageListCaptured', !!messageListBody);
    if (withMarkRead) {
      markRead ??= await grab(form => name(form) === MARK_READ);
      step('markReadCaptured', !!markRead);
      if (!markRead) throw new Error('markReadMissing (open an unread chat); nothing saved');
    }
    // An open chat may not render the Requests link yet; wait, then go back to the inbox list in-page.
    let requestsLink = false;
    for (let attempt = 0; attempt < 6 && !requestsLink; attempt++) {
      if (attempt === 3) { await click('a[href="/messages/"]') || await click('a[href="/messages"]'); }
      requestsLink = await click('a[href="/messages/requests"]');
      if (!requestsLink) await delay(1_500);
    }
    if (!requestsLink) throw new Error('Message requests link not found');
    requests = await grab(form => name(form) === 'BarcelonaMessagesThreadListMailboxQuery' && folder(form) === 'PENDING');
    step('requestsListCaptured', !!requests);
    // The inbox list request does not fire in the page; the requests form with folder INBOX reads it (E21).
    const folders: string[] = await evaluate(pageId, `() => [...new Set([...document.documentElement.innerHTML.matchAll(/\\\\?"folder\\\\?":\\\\?"([A-Z_]+)\\\\?"/g)].map(m => m[1]))]`) ?? [];
    if (requests && folders.includes('INBOX')) {
      const form = new URLSearchParams(requests.body);
      form.set('variables', JSON.stringify({ ...JSON.parse(form.get('variables') ?? '{}'), folder: 'INBOX' }));
      threadListBody = form.toString();
    }
    step('inboxListBuilt', !!threadListBody);

    // Keep the first packets that the receiver accepts as setup for one connection.
    for (let attempt = 0; attempt < 10 && !incoming && requests; attempt++) {
      const sockets: { url: string; packets: string[] }[] = await evaluate(pageId, '() => window.__threadsCapture.map(({ url, packets }) => ({ url, packets }))') ?? [];
      for (const socket of sockets) {
        const packets = socket.packets.map(packet => new Uint8Array(Buffer.from(packet, 'base64')));
        const accept = (initialPackets: Uint8Array[]) => {
          const candidate = { url: socket.url, cookie: requests!.headers.cookie ?? '', userAgent: requests!.headers['user-agent'] ?? '', initialPackets };
          try { new ThreadsDmIncoming({ session: candidate, onMessage() {} }).stop(); incoming = candidate; } catch {}
        };
        for (let i = 0; i < packets.length && !incoming; i++) {
          accept([packets[i]!]);
          for (let j = i + 1; j < packets.length && !incoming; j++) accept([packets[i]!, packets[j]!]);
        }
      }
      if (!incoming) await delay(2_000);
    }
    step('receiverSetupCaptured', !!incoming);

    if (withSend) {
      if (!threadListBody || !messageListBody || !requests || !incoming) throw new Error('capture incomplete; nothing saved');
      const inbox = await new ThreadsDmReader({ session: sessionFromCapturedForms({
        threadListBody, messageListBody, headers: requests.headers,
      }) }).listThreads();
      await call('navigate_page', { pageId, type: 'url', url: `https://www.threads.com/messages/t/${thread}`, timeout: 45_000 });
      const requestIds = (listing: string) => [...listing.matchAll(/reqid=(\d+) POST \S*graphql\S*/g)].map(match => match[1]!);
      const beforeSend = new Set(requestIds(await call('list_network_requests', { pageId, resourceTypes: ['xhr', 'fetch'] })));
      step('Send one plain text message yourself in the opened test chat (no quote or mention); waiting up to 3 minutes.');
      const deadline = performance.now() + 180_000;
      while (!send && performance.now() < deadline) {
        await delay(Math.min(2_500, Math.max(0, deadline - performance.now())));
        if (performance.now() >= deadline) break;
        const remaining = () => Math.max(1, Math.min(60_000, deadline - performance.now()));
        const listing = await call('list_network_requests', { pageId, resourceTypes: ['xhr', 'fetch'] }, remaining());
        for (const reqid of requestIds(listing)) {
          if (beforeSend.has(reqid) || performance.now() >= deadline) continue;
          beforeSend.add(reqid);
          const request = parseRequest(await call('get_network_request', { pageId, reqid: Number(reqid) }, remaining()));
          if (name(new URLSearchParams(request.body)) !== 'WmiSlideTextMessageMutation') continue;
          const result = captureSendTemplate(request, inbox, username, thread!);
          if ('reason' in result) throw new Error(`${result.reason}; nothing saved`);
          send = result.send;
          break;
        }
      }
      if (!send) throw new Error('sendTemplateMissing; nothing saved');
      step('sendTemplateCaptured', true);
    }
  } finally {
    await call('close_page', { pageId }).catch(() => step('captureTabCloseFailed'));
  }
} finally { await mcp.close(); }

if (!threadListBody || !messageListBody || !requests || !incoming) {
  console.error('capture incomplete; nothing saved');
  process.exit(1);
}
await saveThreadsSession(out, {
  version: 1, username, capturedAt: new Date().toISOString(),
  forms: { threadListBody, messageListBody, headers: requests.headers }, requestsListBody: requests.body, incoming,
  ...(send ? { send } : {}),
  ...(markRead ? { markRead } : {}),
});
step('saved', true);

// Prove the saved file works on its own: one inbox read and one receiver connection.
const saved = await loadThreadsSession(out);
const inbox = await new ThreadsDmReader({ session: sessionFromCapturedForms(saved.forms) }).listThreads();
step('inboxRead', { chats: inbox.threads.length });
if (withSend) {
  if (!saved.send) throw new Error('sendTemplateUnusable');
  new ThreadsTextSendAttempt({ capture: saved.send, text: SEND_TEMPLATE_PLACEHOLDER,
    threadId: inbox.threads.find(chat => chat.id !== thread)?.id ?? thread!,
  });
  step('sendTemplateUsable', true);
}
if (withMarkRead) {
  if (!saved.markRead) throw new Error('markReadUnusable');
  // Runs the SDK's form checks only; the stub stops before any request is sent.
  const stop = new Error('stop');
  await markThreadRead({ capture: saved.markRead, fetchImpl: async () => { throw stop; } }).catch(error => { if (error !== stop) throw error; });
  step('markReadUsable', true);
}
const receiver = new ThreadsDmIncoming({ session: saved.incoming, onMessage() {} });
try { await receiver.start(); step('receiverReady', true); } finally { receiver.stop(); }
