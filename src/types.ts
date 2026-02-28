export type RequestId = string | number;

export const BACKENDS = ['v1', 'v2', 'lan'] as const;
export type Backend = (typeof BACKENDS)[number];

export function isValidBackend(value: string): value is Backend {
  return (BACKENDS as readonly string[]).includes(value);
}

export interface GoveeDevice {
  device: string;
  model: string;
  deviceName: string;
  controllable: boolean;
  retrievable: boolean;
  supportCmds: string[];
}

export interface GoveeDeviceState {
  device: string;
  model: string;
  properties: Record<string, unknown>[];
}

export interface GoveeScene {
  name: string;
  value: { id: number; paramId: number };
}

export interface GoveeDiyScene {
  name: string;
  value: number;
}

export interface GoveeLanDevice {
  ip: string;
  device: string;
  sku: string;
  bleVersionHard: string;
  bleVersionSoft: string;
  wifiVersionHard: string;
  wifiVersionSoft: string;
}

export interface Api {
  listDevices(): Promise<GoveeDevice[]>;
  getDeviceState(device: string, model: string): Promise<GoveeDeviceState>;
  controlDevice(device: string, model: string, cmd: Record<string, unknown>): Promise<unknown>;
  listScenes?(device: string, model: string): Promise<GoveeScene[]>;
  listDiyScenes?(device: string, model: string): Promise<GoveeDiyScene[]>;
  activateScene?(device: string, model: string, capability: Record<string, unknown>): Promise<unknown>;
}

export interface ApiRouter {
  get(backend?: Backend): Api;
  defaultBackend: Backend;
}

export type ToolResult = { ok: true; text: string } | { ok: false; message: string };

export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>;

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface MCPRequest {
  jsonrpc: '2.0';
  id?: RequestId;
  method: string;
  params?: Record<string, unknown>;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: RequestId | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}
