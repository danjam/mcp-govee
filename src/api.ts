import type { Api, GoveeDevice, GoveeDeviceState } from './types.js';

const GOVEE_API_BASE = 'https://developer-api.govee.com/v1';

export function createApi(apiKey: string): Api {
  async function request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
    const headers: Record<string, string> = { 'Govee-API-Key': apiKey };
    if (body) headers['Content-Type'] = 'application/json';

    const res = await fetch(`${GOVEE_API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Govee API error (${res.status}): ${text}`);
    }

    return res.json();
  }

  async function listDevices(): Promise<GoveeDevice[]> {
    const data = (await request('/devices')) as Record<string, unknown>;
    const devices = (data?.data as Record<string, unknown>)?.devices;
    if (!Array.isArray(devices)) throw new Error('Unexpected Govee API response: missing devices array');
    return devices as GoveeDevice[];
  }

  async function getDeviceState(device: string, model: string): Promise<GoveeDeviceState> {
    const params = new URLSearchParams({ device, model });
    const data = (await request(`/devices/state?${params}`)) as Record<string, unknown>;
    if (!data?.data || typeof data.data !== 'object')
      throw new Error('Unexpected Govee API response: missing state data');
    return data.data as GoveeDeviceState;
  }

  async function controlDevice(device: string, model: string, cmd: Record<string, unknown>): Promise<unknown> {
    return request('/devices/control', 'PUT', { device, model, cmd });
  }

  return { listDevices, getDeviceState, controlDevice };
}
