# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Run

```bash
npm install      # Install dependencies (also runs tsc via prepare)
npm run build    # Compile TypeScript (tsc)
npm start        # Run server (node dist/index.js)
```

Unit tests via `node:test` (built-in), linting via [Biome](https://biomejs.dev/):

```bash
npm test            # Build + run tests
npm run test:only   # Run tests without rebuilding
npm run lint        # Check for issues
npm run lint:fix    # Auto-fix issues
```

## Environment

Requires `GOVEE_API_KEY` env var. Get your key from the Govee Home app: Settings → About Us → Apply for API Key.

## Manual Testing

Pipe JSON-RPC messages to stdin:
```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_devices","arguments":{}}}\n' | GOVEE_API_KEY=your-key node dist/index.js
```

## Architecture

This is a **Model Context Protocol (MCP) server** that wraps the Govee REST API (v1). It communicates over **stdin/stdout using JSON-RPC 2.0** — there is no HTTP server or MCP SDK dependency.

**Source files:**
- `src/index.ts` — Entrypoint: I/O helpers (`send`, `reply`, `textReply`, `error`), request dispatch, readline listener
- `src/handlers.ts` — `createHandlers(api: Api)` factory returning a handler map; uses `ok`/`fail` helpers for `ToolResult`, `parseDevice` to extract common device args, and `validateInt` for numeric parameter validation
- `src/tools.ts` — Tool schema definitions (static JSON Schema data for MCP `tools/list`)
- `src/api.ts` — `createApi()` factory wrapping Govee REST API calls (`listDevices`, `getDeviceState`, `controlDevice`)
- `src/types.ts` — All type definitions: `Api`, `RequestId`, `ToolResult`, `ToolHandler`, Govee interfaces, MCP interfaces

**Request flow:** stdin line → JSON parse → `handleRequest` dispatches by MCP method (`initialize`, `tools/list`, `tools/call`) → `handleToolCall` looks up handler in map → handler returns `ToolResult` → dispatch maps result to JSON-RPC response on stdout.

**Tools exposed:** `list_devices`, `get_device_state`, `set_power`, `set_brightness`, `set_color`, `set_color_temperature`.

**Device identification:** All device commands require both `device_id` (MAC address) and `model` string, obtained from `list_devices`.

## Project Config

- ES modules (`"type": "module"` in package.json)
- TypeScript strict mode (`verbatimModuleSyntax`, `noUncheckedIndexedAccess`, `noFallthroughCasesInSwitch`), target ES2022, module NodeNext
- Output to `dist/`, source in `src/`
- Executable as CLI via shebang (`#!/usr/bin/env node`) and `"bin"` field — supports `npx -y github:danjam/mcp-govee`
- Zero runtime dependencies (uses built-in `fetch`)

## Code Style

Biome enforces: single quotes, trailing commas, 2-space indent, 120 char line width. Run `npm run lint:fix` to auto-format.

## Gotchas

- **Import extensions**: NodeNext module resolution requires `.js` extensions in imports (e.g., `import { createApi } from './api.js'`), even though source files are `.ts`.
- **Tests are plain JS**: Test files in `test/` are `.js` and import from `../dist/`. Run `npm run build` first (or use `npm test` which builds automatically).
