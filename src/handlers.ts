import type { Api, ApiRouter, Backend, ToolHandler, ToolResult } from './types.js';
import { BACKENDS, isValidBackend } from './types.js';

function ok(text: string): ToolResult {
  return { ok: true, text };
}

function fail(message: string): ToolResult {
  return { ok: false, message };
}

function validateInt(value: unknown, name: string, min: number, max: number): string | undefined {
  if (value == null) return `${name} is required`;
  if (!Number.isInteger(value)) return `${name} must be an integer`;
  if ((value as number) < min || (value as number) > max) return `${name} must be between ${min} and ${max}`;
  return undefined;
}

interface DeviceContext {
  api: Api;
  deviceId: string;
  model: string;
}

function parseDeviceAndBackend(
  router: ApiRouter,
  args: Record<string, unknown>,
  backend?: Backend,
): DeviceContext | ToolResult {
  const deviceId = args.device_id as string | undefined;
  const model = args.model as string | undefined;
  if (!deviceId || !model) return fail('device_id and model are required');

  const resolvedBackend = resolveBackend(args, backend);
  if ('ok' in resolvedBackend) return resolvedBackend;

  return { api: router.get(resolvedBackend.value), deviceId, model };
}

function resolveBackend(
  args: Record<string, unknown>,
  override?: Backend,
): { value: Backend | undefined } | ToolResult {
  if (override) return { value: override };
  const backend = args.backend as string | undefined;
  if (!backend) return { value: undefined };
  if (!isValidBackend(backend))
    return fail(`Invalid backend '${backend}'. Must be ${BACKENDS.map((b) => `'${b}'`).join(', ')}.`);
  return { value: backend };
}

export function createHandlers(router: ApiRouter): Record<string, ToolHandler> {
  async function handleListDevices(args: Record<string, unknown>): Promise<ToolResult> {
    const resolved = resolveBackend(args);
    if ('ok' in resolved) return resolved;

    const api = router.get(resolved.value);
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
    const ctx = parseDeviceAndBackend(router, args);
    if ('ok' in ctx) return ctx;

    const state = await ctx.api.getDeviceState(ctx.deviceId, ctx.model);
    return ok(JSON.stringify(state, null, 2));
  }

  async function handleSetPower(args: Record<string, unknown>): Promise<ToolResult> {
    const ctx = parseDeviceAndBackend(router, args);
    if ('ok' in ctx) return ctx;

    const state = args.state as string | undefined;
    if (!state) return fail('state is required');
    if (state !== 'on' && state !== 'off') return fail("state must be 'on' or 'off'");

    await ctx.api.controlDevice(ctx.deviceId, ctx.model, { name: 'turn', value: state });
    return ok(`Device turned ${state} successfully.`);
  }

  async function handleSetBrightness(args: Record<string, unknown>): Promise<ToolResult> {
    const ctx = parseDeviceAndBackend(router, args);
    if ('ok' in ctx) return ctx;

    const brightness = args.brightness as number | undefined;
    const err = validateInt(brightness, 'brightness', 0, 100);
    if (err) return fail(err);

    await ctx.api.controlDevice(ctx.deviceId, ctx.model, { name: 'brightness', value: brightness });
    return ok(`Brightness set to ${brightness}%.`);
  }

  async function handleSetColor(args: Record<string, unknown>): Promise<ToolResult> {
    const ctx = parseDeviceAndBackend(router, args);
    if ('ok' in ctx) return ctx;

    const r = args.r as number | undefined;
    const g = args.g as number | undefined;
    const b = args.b as number | undefined;
    const colorErr = validateInt(r, 'r', 0, 255) ?? validateInt(g, 'g', 0, 255) ?? validateInt(b, 'b', 0, 255);
    if (colorErr) return fail(colorErr);

    await ctx.api.controlDevice(ctx.deviceId, ctx.model, { name: 'color', value: { r, g, b } });
    return ok(`Color set to RGB(${r}, ${g}, ${b}).`);
  }

  async function handleSetColorTemperature(args: Record<string, unknown>): Promise<ToolResult> {
    const ctx = parseDeviceAndBackend(router, args);
    if ('ok' in ctx) return ctx;

    const temperature = args.temperature as number | undefined;
    const tempErr = validateInt(temperature, 'temperature', 2000, 9000);
    if (tempErr) return fail(tempErr);

    await ctx.api.controlDevice(ctx.deviceId, ctx.model, { name: 'colorTem', value: temperature });
    return ok(`Color temperature set to ${temperature}K.`);
  }

  async function handleListScenesByType(
    args: Record<string, unknown>,
    getListFn: (api: Api) => ((device: string, model: string) => Promise<unknown[]>) | undefined,
    toolName: string,
  ): Promise<ToolResult> {
    const ctx = parseDeviceAndBackend(router, args, 'v2');
    if ('ok' in ctx) return ctx;

    const listFn = getListFn(ctx.api);
    if (!listFn) return fail(`${toolName} is only available with the v2 backend`);

    const scenes = await listFn(ctx.deviceId, ctx.model);
    return ok(JSON.stringify(scenes, null, 2));
  }

  async function handleActivateScene(args: Record<string, unknown>): Promise<ToolResult> {
    const ctx = parseDeviceAndBackend(router, args, 'v2');
    if ('ok' in ctx) return ctx;

    const sceneName = args.scene_name as string | undefined;
    const sceneType = args.scene_type as string | undefined;
    if (!sceneName) return fail('scene_name is required');
    if (sceneType !== 'light' && sceneType !== 'diy') return fail("scene_type must be 'light' or 'diy'");

    if (!ctx.api.activateScene) return fail('activate_scene is only available with the v2 backend');

    const isDiy = sceneType === 'diy';
    const listFn = isDiy ? ctx.api.listDiyScenes : ctx.api.listScenes;
    if (!listFn) return fail('activate_scene is only available with the v2 backend');

    const scenes = await listFn(ctx.deviceId, ctx.model);
    const label = isDiy ? 'DIY scene' : 'Scene';
    const scene = scenes.find((s) => s.name === sceneName);
    if (!scene) return fail(`${label} '${sceneName}' not found`);

    await ctx.api.activateScene(ctx.deviceId, ctx.model, sceneType, scene.value);
    return ok(`${label} '${sceneName}' activated.`);
  }

  return {
    list_devices: handleListDevices,
    get_device_state: handleGetDeviceState,
    set_power: handleSetPower,
    set_brightness: handleSetBrightness,
    set_color: handleSetColor,
    set_color_temperature: handleSetColorTemperature,
    list_scenes: (args) => handleListScenesByType(args, (api) => api.listScenes, 'list_scenes'),
    list_diy_scenes: (args) => handleListScenesByType(args, (api) => api.listDiyScenes, 'list_diy_scenes'),
    activate_scene: handleActivateScene,
  };
}
