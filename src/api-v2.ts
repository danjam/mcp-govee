import type { Api, GoveeDevice, GoveeDeviceState, GoveeDiyScene, GoveeScene } from './types.js';

const GOVEE_V2_BASE = 'https://openapi.api.govee.com/router/api/v1';

export function createV2Api(apiKey: string): Api {
  async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = {
      'Govee-API-Key': apiKey,
      'Content-Type': 'application/json',
    };

    const res = await fetch(`${GOVEE_V2_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Govee v2 API error (${res.status}): ${text}`);
    }

    return res.json();
  }

  async function v2Post(path: string, device: string, model: string, extra?: Record<string, unknown>) {
    const requestId = crypto.randomUUID();
    return request(path, 'POST', {
      requestId,
      payload: { sku: model, device, ...extra },
    }) as Promise<Record<string, unknown>>;
  }

  async function listDevices(): Promise<GoveeDevice[]> {
    const data = (await request('/user/devices')) as Record<string, unknown>;
    const devices = (data?.data as unknown[]) ?? [];
    if (!Array.isArray(devices)) throw new Error('Unexpected Govee v2 API response: missing devices array');
    return (devices as Record<string, unknown>[]).map((d) => ({
      device: d.device as string,
      model: d.sku as string,
      deviceName: d.deviceName as string,
      controllable: true,
      retrievable: true,
      supportCmds: extractSupportCmds(d.capabilities as unknown[]),
    }));
  }

  function extractSupportCmds(capabilities: unknown[]): string[] {
    if (!Array.isArray(capabilities)) return [];
    const cmds: string[] = [];
    for (const cap of capabilities) {
      const c = cap as Record<string, unknown>;
      if (c.type === 'devices.capabilities.on_off') cmds.push('turn');
      if (c.type === 'devices.capabilities.range' && c.instance === 'brightness') cmds.push('brightness');
      if (c.type === 'devices.capabilities.color_setting' && c.instance === 'colorRgb') cmds.push('color');
      if (c.type === 'devices.capabilities.color_setting' && c.instance === 'colorTemperatureK') cmds.push('colorTem');
    }
    return cmds;
  }

  async function getDeviceState(device: string, model: string): Promise<GoveeDeviceState> {
    const data = await v2Post('/device/state', device, model);

    const payload = data?.payload as Record<string, unknown>;
    if (!payload) throw new Error('Unexpected Govee v2 API response: missing payload');

    const capabilities = (payload.capabilities as Record<string, unknown>[]) ?? [];
    const properties: Record<string, unknown>[] = [];
    for (const cap of capabilities) {
      if (cap.type === 'devices.capabilities.on_off') {
        properties.push({ powerState: cap.state === 1 ? 'on' : 'off' });
      } else if (cap.type === 'devices.capabilities.range' && cap.instance === 'brightness') {
        properties.push({ brightness: cap.state });
      } else if (cap.type === 'devices.capabilities.color_setting' && cap.instance === 'colorRgb') {
        const colorInt = cap.state as number;
        properties.push({ color: { r: (colorInt >> 16) & 0xff, g: (colorInt >> 8) & 0xff, b: colorInt & 0xff } });
      } else if (cap.type === 'devices.capabilities.color_setting' && cap.instance === 'colorTemperatureK') {
        properties.push({ colorTem: cap.state });
      }
    }

    return { device, model, properties };
  }

  function translateCmd(cmd: Record<string, unknown>): Record<string, unknown> {
    const name = cmd.name as string;
    const value = cmd.value;
    switch (name) {
      case 'turn':
        return { type: 'devices.capabilities.on_off', instance: 'powerSwitch', value: value === 'on' ? 1 : 0 };
      case 'brightness':
        return { type: 'devices.capabilities.range', instance: 'brightness', value };
      case 'color': {
        const c = value as { r: number; g: number; b: number };
        return {
          type: 'devices.capabilities.color_setting',
          instance: 'colorRgb',
          value: (c.r << 16) | (c.g << 8) | c.b,
        };
      }
      case 'colorTem':
        return { type: 'devices.capabilities.color_setting', instance: 'colorTemperatureK', value };
      default:
        throw new Error(`Unknown command: ${name}`);
    }
  }

  async function controlDevice(device: string, model: string, cmd: Record<string, unknown>): Promise<unknown> {
    const capability = translateCmd(cmd);
    return v2Post('/device/control', device, model, { capability });
  }

  async function fetchSceneOptions(
    path: string,
    instance: string,
    device: string,
    model: string,
  ): Promise<Record<string, unknown>[]> {
    const data = await v2Post(path, device, model);

    const payload = data?.payload as Record<string, unknown>;
    if (!payload) throw new Error('Unexpected Govee v2 API response: missing payload');

    const capabilities = (payload.capabilities as Record<string, unknown>[]) ?? [];
    const cap = capabilities.find((c) => c.type === 'devices.capabilities.dynamic_scene' && c.instance === instance);
    if (!cap) return [];

    const parameters = cap.parameters as Record<string, unknown>;
    return (parameters?.options as Record<string, unknown>[]) ?? [];
  }

  async function listScenes(device: string, model: string): Promise<GoveeScene[]> {
    const options = await fetchSceneOptions('/device/scenes', 'lightScene', device, model);
    return options.map((o) => ({
      name: o.name as string,
      value: o.value as { id: number; paramId: number },
    }));
  }

  async function listDiyScenes(device: string, model: string): Promise<GoveeDiyScene[]> {
    const options = await fetchSceneOptions('/device/diy-scenes', 'diyScene', device, model);
    return options.map((o) => ({
      name: o.name as string,
      value: o.value as number,
    }));
  }

  async function activateScene(device: string, model: string, capability: Record<string, unknown>): Promise<unknown> {
    return v2Post('/device/control', device, model, { capability });
  }

  return { listDevices, getDeviceState, controlDevice, listScenes, listDiyScenes, activateScene };
}
