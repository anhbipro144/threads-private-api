import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { StdioMcp } from './stdio-mcp.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const server = process.argv[2];
assert(server === 'rea' || server === 'chrome', 'Select rea or chrome');
const args = server === 'rea'
  ? [`${root}node_modules/rea-agents/scripts/rea.mjs`, 'mcp']
  : [`${root}node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js`,
    '--autoConnect', '--redact-network-headers', '--no-usage-statistics', '--no-performance-crux'];
const client = new StdioMcp(`${root}node_modules/node/bin/node`, args, root);
type Tool = { name: string; inputSchema: unknown };
type ToolResult = { isError?: boolean; content?: { type: string; text?: string }[] };
async function call(name: string, args: object): Promise<ToolResult> {
  const result = await client.request('tools/call', { name, arguments: args }) as ToolResult;
  assert(!result.isError, `Tool failed: ${name}`);
  console.log(`PASS ${name}`);
  return result;
}
let ownedPageId: number | undefined;
try {
  await client.initialize();
  const listed = await client.request('tools/list') as { tools: Tool[] };
  assert(Array.isArray(listed.tools));
  console.log(`${server}: initialize and tools/list passed; ${listed.tools.length} tools`);
  if (process.argv.includes('--list')) {
    console.log(JSON.stringify(listed.tools.filter(t => server === 'rea'
      ? /capabilit|status|javascript/.test(t.name)
      : /^(list_pages|navigate_page|take_snapshot|list_network_requests|get_network_request|evaluate_script)$/.test(t.name))));
  } else if (server === 'chrome') {
    const before = await call('list_pages', {});
    const existingIds = new Set((before.content?.map(c => c.text ?? '').join('\n') ?? '')
      .split('\n').map(line => line.match(/^(\d+):/)?.[1]).filter(Boolean));
    // Own a temporary tab; never navigate the owner's existing tabs.
    const opened = await call('new_page', { url: 'https://example.com' });
    const pageText = opened.content?.map(c => c.text ?? '').join('\n') ?? '';
    const pageLine = pageText.split('\n').find(line => /https:\/\/example\.com/.test(line) &&
      !existingIds.has(line.match(/^(\d+):/)?.[1]));
    const pageId = Number(pageLine?.match(/^(\d+):/)?.[1]);
    assert(Number.isInteger(pageId), 'Cannot identify owned verification tab');
    ownedPageId = pageId;
    await call('take_snapshot', { pageId });
    const requests = await call('list_network_requests', { pageId });
    const requestText = requests.content?.map(c => c.text ?? '').join('\n') ?? '';
    const reqid = Number(requestText.match(/reqid=(\d+)/)?.[1]);
    assert(Number.isInteger(reqid), 'No public network request');
    await call('get_network_request', { pageId, reqid });
    await call('evaluate_script', { pageId, function: '() => ({ title: document.title, origin: location.origin })' });
    if (process.argv.includes('--threads-public')) {
      await call('navigate_page', { pageId, url: 'https://www.threads.com/' });
      const result = await call('evaluate_script', { pageId, function: `() => ({origin: location.origin, loginVisible: [...document.querySelectorAll('button,a,input')].some(el => /log in|đăng nhập/i.test(el.textContent || el.getAttribute('placeholder') || '')), inboxVisible: [...document.querySelectorAll('a')].some(el => /messages|inbox/i.test(el.getAttribute('href') || ''))})` });
      console.log(JSON.stringify(result));
    }
  } else {
    const tool = listed.tools.find(t => t.name === 'inspect_analysis_settings');
    assert(tool, 'REA inspect_analysis_settings tool missing; inspect --list');
    await call(tool.name, {});
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Verification failed');
  process.exitCode = 1;
} finally {
  if (ownedPageId !== undefined) {
    try { await call('close_page', { pageId: ownedPageId }); } catch { /* owner may already have closed the tab */ }
  }
  await client.close();
}
