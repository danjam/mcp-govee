import type { Api, ToolHandler, ToolResult } from './types.js';

function ok(text: string): ToolResult {
  return { ok: true, text };
}

function fail(message: string): ToolResult {
  return { ok: false, message };
}

function parseDevice(args: Record<string, unknown>): { deviceId: string; model: string } | ToolResult {
  const deviceId = args.device_id as string | undefined;
  const model = args.model as string | undefined;
  if (!deviceId || !model) return fail('device_id and model are required');
  return { deviceId, model };
}

function validateInt(value: unknown, name: string, min: number, max: number): string | undefined {
  if (value == null) return `${name} is required`;
  if (!Number.isInteger(value)) return `${name} must be an integer`;
  if ((value as number) < min || (value as number) > max) return `${name} must be between ${min} and ${max}`;
  return undefined;
}

export function createHandlers(api: Api): Record<string, ToolHandler> {
  async function handleListDevices(): Promise<ToolResult> {
    const devices = await api.listDevices();
    const formatted = devices.map((d) => ({
      device_id: d.device,
      model: d.model,
      name: d.deviceName,
      controllable: d.controllable,
      retrievable: d.retrievable,
      supported_commands: d.supportCmds,
    }));
    return ok(JSON.stringify(formatted, null, 2));
  }

  async function handleGetDeviceState(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if ('ok' in device) return device;

    const state = await api.getDeviceState(device.deviceId, device.model);
    return ok(JSON.stringify(state, null, 2));
  }

  async function handleSetPower(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if ('ok' in device) return device;

    const state = args.state as string | undefined;
    if (!state) return fail('state is required');
    if (state !== 'on' && state !== 'off') return fail("state must be 'on' or 'off'");

    await api.controlDevice(device.deviceId, device.model, { name: 'turn', value: state });
    return ok(`Device turned ${state} successfully.`);
  }

  async function handleSetBrightness(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if ('ok' in device) return device;

    const brightness = args.brightness as number | undefined;
    const err = validateInt(brightness, 'brightness', 0, 100);
    if (err) return fail(err);

    await api.controlDevice(device.deviceId, device.model, { name: 'brightness', value: brightness });
    return ok(`Brightness set to ${brightness}%.`);
  }

  async function handleSetColor(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if ('ok' in device) return device;

    const r = args.r as number | undefined;
    const g = args.g as number | undefined;
    const b = args.b as number | undefined;
    const colorErr = validateInt(r, 'r', 0, 255) ?? validateInt(g, 'g', 0, 255) ?? validateInt(b, 'b', 0, 255);
    if (colorErr) return fail(colorErr);

    await api.controlDevice(device.deviceId, device.model, { name: 'color', value: { r, g, b } });
    return ok(`Color set to RGB(${r}, ${g}, ${b}).`);
  }

  async function handleSetColorTemperature(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if ('ok' in device) return device;

    const temperature = args.temperature as number | undefined;
    const tempErr = validateInt(temperature, 'temperature', 2000, 9000);
    if (tempErr) return fail(tempErr);

    await api.controlDevice(device.deviceId, device.model, { name: 'colorTem', value: temperature });
    return ok(`Color temperature set to ${temperature}K.`);
  }

  return {
    list_devices: handleListDevices,
    get_device_state: handleGetDeviceState,
    set_power: handleSetPower,
    set_brightness: handleSetBrightness,
    set_color: handleSetColor,
    set_color_temperature: handleSetColorTemperature,
  };
}
