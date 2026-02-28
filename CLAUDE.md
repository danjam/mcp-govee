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

Optional env vars:
- `GOVEE_API_BACKEND` — Default backend: `v1` (default), `v2`, or `lan`
- `GOVEE_LAN_ENABLED=true` — Enable the LAN backend (requires devices on the same network)

## Manual Testing

Pipe JSON-RPC messages to stdin:
```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize"}\n{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_devices","arguments":{}}}\n' | GOVEE_API_KEY=your-key node dist/index.js
```

## Architecture

This is a **Model Context Protocol (MCP) server** that wraps the Govee API. It communicates over **stdin/stdout using JSON-RPC 2.0** — there is no HTTP server or MCP SDK dependency.

**Multi-backend architecture:** Supports three backends — v1 (REST), v2 (REST, richer features), and LAN (UDP multicast, local network). An `ApiRouter` dispatches to the selected backend; all backends implement the shared `Api` interface.

**Source files:**
- `src/index.ts` — Entrypoint: I/O helpers (`send`, `reply`, `textReply`, `error`), env var parsing, request dispatch, readline listener
- `src/handlers.ts` — `createHandlers(router: ApiRouter)` factory returning a handler map; uses `ok`/`fail` helpers for `ToolResult`, `parseDeviceAndBackend` to extract device args and resolve the backend into a `DeviceContext`, and `validateInt` for numeric validation
- `src/tools.ts` — Tool schema definitions (static JSON Schema data for MCP `tools/list`)
- `src/api.ts` — `createApiRouter()` factory that instantiates and routes between backends
- `src/api-v1.ts` — `createV1Api()` wrapping Govee REST API v1 (`listDevices`, `getDeviceState`, `controlDevice`)
- `src/api-v2.ts` — `createV2Api()` wrapping Govee REST API v2 (adds `listScenes`, `listDiyScenes`, `activateScene`)
- `src/api-lan.ts` — `createLanApi()` wrapping Govee LAN API via UDP multicast (device discovery + control, no cloud dependency)
- `src/types.ts` — All type definitions: `Api`, `ApiRouter`, `Backend`, `RequestId`, `ToolResult`, `ToolHandler`, Govee interfaces, MCP interfaces

**Request flow:** stdin line → JSON parse → `handleRequest` dispatches by MCP method (`initialize`, `tools/list`, `tools/call`) → `handleToolCall` looks up handler in map → handler returns `ToolResult` → dispatch maps result to JSON-RPC response on stdout.

**Tools exposed:** `list_devices`, `get_device_state`, `set_power`, `set_brightness`, `set_color`, `set_color_temperature`, `list_scenes` (v2 only), `list_diy_scenes` (v2 only), `activate_scene` (v2 only).

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
