import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { StdioMcp } from './stdio-mcp.ts';

const root = fileURLToPath(new URL('../../', import.meta.url));
const server = process.argv[2];
assert(server === 'rea' || server === 'chrome', 'Select rea or chrome');
const args = server === 'rea'
  ? [`${root}node_modules/rea-agents/scripts/rea.mjs`, 'mcp']
  : [`${root}node_modules/chrome-devtools-mcp/build/src/bin/chrome-devtools-mcp.js`,
    '--isolated', '--redact-network-headers', '--no-usage-statistics', '--no-performance-crux'];
const client = new StdioMcp(`${root}node_modules/node/bin/node`, args, root);
type Tool = { name: string; inputSchema: unknown };
type ToolResult = { isError?: boolean; content?: { type: string; text?: string }[] };
async function call(name: string, args: object): Promise<ToolResult> {
  const result = await client.request('tools/call', { name, arguments: args }) as ToolResult;
  assert(!result.isError, `Tool failed: ${name}`);
  console.log(`PASS ${name}`);
  return result;
}
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
    const pages = await call('list_pages', {});
    const pageText = pages.content?.map(c => c.text ?? '').join('\n') ?? '';
    const pageId = Number(pageText.match(/(?:^|\n)(\d+):/)?.[1]);
    assert(Number.isInteger(pageId), 'Cannot identify isolated page');
    await call('navigate_page', { pageId, url: 'https://example.com' });
    await call('take_snapshot', { pageId });
    const requests = await call('list_network_requests', { pageId });
    const requestText = requests.content?.map(c => c.text ?? '').join('\n') ?? '';
    const reqid = Number(requestText.match(/reqid=(\d+)/)?.[1]);
    assert(Number.isInteger(reqid), 'No public network request');
    await call('get_network_request', { pageId, reqid });
    await call('evaluate_script', { pageId, function: '() => ({ title: document.title, origin: location.origin })' });
    if (process.argv.includes('--threads-public')) {
      await call('navigate_page', { pageId, url: 'https://www.threads.com/' });
      const result = await call('evaluate_script', { pageId, function: `() => ({origin: location.origin, title: document.title, loginVisible: /log in|log into|đăng nhập/i.test(document.body.innerText), inboxVisible: /messages|tin nhắn/i.test(document.body.innerText)})` });
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
  await client.close();
}
