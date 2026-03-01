#!/usr/bin/env node
import { createInterface } from 'node:readline';

import { createApiRouter } from './api.js';
import { createHandlers } from './handlers.js';
import { tools } from './tools.js';
import { BACKENDS, isValidBackend, type MCPRequest, type MCPResponse, type RequestId } from './types.js';

const apiKey = process.env.GOVEE_API_KEY;
if (!apiKey) {
  console.error('GOVEE_API_KEY environment variable is required');
  console.error('Get your API key from the Govee Home app: Settings → About Us → Apply for API Key');
  process.exit(1);
}

const defaultBackend = process.env.GOVEE_API_BACKEND ?? 'v1';
if (!isValidBackend(defaultBackend)) {
  console.error(`Invalid GOVEE_API_BACKEND: '${defaultBackend}'. Must be ${BACKENDS.map((b) => `'${b}'`).join(', ')}.`);
  process.exit(1);
}

const lanEnabled = process.env.GOVEE_LAN_ENABLED === 'true';

const router = createApiRouter({ apiKey, defaultBackend, lanEnabled });

function send(msg: MCPResponse): void {
  process.stdout.write(`${JSON.stringify(msg)}\n`);
}

function reply(id: RequestId, result: unknown): void {
  send({ jsonrpc: '2.0', id, result });
}

function textReply(id: RequestId, text: string): void {
  reply(id, { content: [{ type: 'text', text }] });
}

function error(id: RequestId, code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

const handlers = createHandlers(router);

async function handleToolCall(id: RequestId, name: string, args: Record<string, unknown>): Promise<void> {
  const handler = handlers[name];
  if (!handler) {
    error(id, -32601, `Unknown tool: ${name}`);
    return;
  }
  try {
    const result = await handler(args);
    if (result.ok) {
      textReply(id, result.text);
    } else {
      reply(id, { content: [{ type: 'text', text: result.message }], isError: true });
    }
  } catch (e) {
    reply(id, { content: [{ type: 'text', text: e instanceof Error ? e.message : 'Internal error' }], isError: true });
  }
}

function handleRequest(req: MCPRequest): void {
  if (req.id == null) return;
  const id = req.id;

  switch (req.method) {
    case 'initialize':
      reply(id, {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'mcp-govee', version: '1.0.0' },
        capabilities: { tools: {} },
      });
      break;
    case 'tools/list':
      reply(id, { tools });
      break;
    case 'tools/call':
      void handleToolCall(id, req.params?.name as string, (req.params?.arguments ?? {}) as Record<string, unknown>);
      break;
    case 'ping':
      reply(id, {});
      break;
    default:
      error(id, -32601, 'Method not found');
  }
}

const rl = createInterface({ input: process.stdin, terminal: false });
rl.on('line', function handleLine(line: string): void {
  if (!line.trim()) return;
  try {
    handleRequest(JSON.parse(line));
  } catch {
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
});
