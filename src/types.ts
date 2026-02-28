export type RequestId = string | number;

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

export interface Api {
  listDevices(): Promise<GoveeDevice[]>;
  getDeviceState(device: string, model: string): Promise<GoveeDeviceState>;
  controlDevice(device: string, model: string, cmd: Record<string, unknown>): Promise<unknown>;
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
