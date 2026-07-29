import assert from 'node:assert/strict';

const endpoint = process.env.MCP_URL ?? 'http://127.0.0.1:8931/mcp';
const mode = process.argv[2] ?? 'check';
const marker = 'playwright-mcp-persistent-marker';
let requestId = 0;
let sessionId;

function decodeResponse(contentType, body) {
  if (!body.trim()) return undefined;
  if (!contentType.includes('text/event-stream')) return JSON.parse(body);

  const messages = body
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter((line) => line && line !== '[DONE]')
    .map(JSON.parse);
  return messages.at(-1);
}

async function send(payload, includeSession = true) {
  const headers = {
    accept: 'application/json, text/event-stream',
    'content-type': 'application/json',
  };
  if (includeSession && sessionId) headers['mcp-session-id'] = sessionId;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const body = await response.text();
  assert.ok(response.ok, `MCP returned ${response.status}: ${body}`);
  sessionId ??= response.headers.get('mcp-session-id');
  return decodeResponse(response.headers.get('content-type') ?? '', body);
}

async function request(method, params = {}) {
  const id = ++requestId;
  const message = await send({ jsonrpc: '2.0', id, method, params });
  assert.equal(message?.id, id, `Unexpected JSON-RPC response: ${JSON.stringify(message)}`);
  assert.ok(!message.error, `MCP error: ${JSON.stringify(message.error)}`);
  return message.result;
}

await send({
  jsonrpc: '2.0',
  id: ++requestId,
  method: 'initialize',
  params: {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'compose-smoke-test', version: '1.0.0' },
  },
}, false);
assert.ok(sessionId, 'The server did not return an MCP session ID');
await send({ jsonrpc: '2.0', method: 'notifications/initialized' });

const toolList = await request('tools/list');
const toolNames = new Set(toolList.tools.map((tool) => tool.name));
assert.ok(toolNames.has('browser_evaluate'), 'browser_evaluate tool is missing');

if (mode === 'set') {
  assert.ok(toolNames.has('browser_navigate'), 'browser_navigate tool is missing');
  assert.ok(toolNames.has('browser_take_screenshot'), 'browser_take_screenshot tool is missing');
  await request('tools/call', {
    name: 'browser_navigate',
    arguments: { url: 'about:blank' },
  });
  await request('tools/call', {
    name: 'browser_evaluate',
    arguments: {
      function: `() => { document.title = '${marker}'; document.body.textContent = '${marker}'; return document.title; }`,
    },
  });
  const screenshotResult = await request('tools/call', {
    name: 'browser_take_screenshot',
    arguments: { filename: '/data/output/smoke-screenshot.png', type: 'png' },
  });
  assert.ok(!screenshotResult.isError, `Screenshot tool failed: ${JSON.stringify(screenshotResult)}`);
  console.log(`Stored marker in browser page: ${marker}`);
} else {
  const result = await request('tools/call', {
    name: 'browser_evaluate',
    arguments: { function: '() => ({ title: document.title, body: document.body.textContent })' },
  });
  assert.match(JSON.stringify(result), new RegExp(marker), 'The browser page did not survive the MCP session/restart');
  console.log(`Found persistent marker: ${marker}`);
}

const closeResponse = await fetch(endpoint, {
  method: 'DELETE',
  headers: { 'mcp-session-id': sessionId },
});
assert.ok(closeResponse.ok || closeResponse.status === 405, `Session close returned ${closeResponse.status}`);
