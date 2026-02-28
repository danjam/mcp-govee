import { type ApiRouter, BACKENDS, type Backend, isValidBackend, type ToolHandler, type ToolResult } from './types.js';

function ok(text: string): ToolResult {
  return { ok: true, text };
}

function fail(message: string): ToolResult {
  return { ok: false, message };
}

function isToolResult(v: unknown): v is ToolResult {
  return typeof v === 'object' && v !== null && 'ok' in v;
}

function parseDevice(args: Record<string, unknown>): { deviceId: string; model: string } | ToolResult {
  const deviceId = args.device_id as string | undefined;
  const model = args.model as string | undefined;
  if (!deviceId || !model) return fail('device_id and model are required');
  return { deviceId, model };
}

function parseBackend(args: Record<string, unknown>): Backend | ToolResult | undefined {
  const backend = args.backend as string | undefined;
  if (!backend) return undefined;
  if (!isValidBackend(backend))
    return fail(`Invalid backend '${backend}'. Must be ${BACKENDS.map((b) => `'${b}'`).join(', ')}.`);
  return backend;
}

function validateInt(value: unknown, name: string, min: number, max: number): string | undefined {
  if (value == null) return `${name} is required`;
  if (!Number.isInteger(value)) return `${name} must be an integer`;
  if ((value as number) < min || (value as number) > max) return `${name} must be between ${min} and ${max}`;
  return undefined;
}

export function createHandlers(router: ApiRouter): Record<string, ToolHandler> {
  async function handleListDevices(args: Record<string, unknown>): Promise<ToolResult> {
    const backend = parseBackend(args);
    if (isToolResult(backend)) return backend;

    const api = router.get(backend);
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
    if (isToolResult(device)) return device;

    const backend = parseBackend(args);
    if (isToolResult(backend)) return backend;

    const api = router.get(backend);
    const state = await api.getDeviceState(device.deviceId, device.model);
    return ok(JSON.stringify(state, null, 2));
  }

  async function handleSetPower(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if (isToolResult(device)) return device;

    const state = args.state as string | undefined;
    if (!state) return fail('state is required');
    if (state !== 'on' && state !== 'off') return fail("state must be 'on' or 'off'");

    const backend = parseBackend(args);
    if (isToolResult(backend)) return backend;

    const api = router.get(backend);
    await api.controlDevice(device.deviceId, device.model, { name: 'turn', value: state });
    return ok(`Device turned ${state} successfully.`);
  }

  async function handleSetBrightness(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if (isToolResult(device)) return device;

    const brightness = args.brightness as number | undefined;
    const err = validateInt(brightness, 'brightness', 0, 100);
    if (err) return fail(err);

    const backend = parseBackend(args);
    if (isToolResult(backend)) return backend;

    const api = router.get(backend);
    await api.controlDevice(device.deviceId, device.model, { name: 'brightness', value: brightness });
    return ok(`Brightness set to ${brightness}%.`);
  }

  async function handleSetColor(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if (isToolResult(device)) return device;

    const r = args.r as number | undefined;
    const g = args.g as number | undefined;
    const b = args.b as number | undefined;
    const colorErr = validateInt(r, 'r', 0, 255) ?? validateInt(g, 'g', 0, 255) ?? validateInt(b, 'b', 0, 255);
    if (colorErr) return fail(colorErr);

    const backend = parseBackend(args);
    if (isToolResult(backend)) return backend;

    const api = router.get(backend);
    await api.controlDevice(device.deviceId, device.model, { name: 'color', value: { r, g, b } });
    return ok(`Color set to RGB(${r}, ${g}, ${b}).`);
  }

  async function handleSetColorTemperature(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if (isToolResult(device)) return device;

    const temperature = args.temperature as number | undefined;
    const tempErr = validateInt(temperature, 'temperature', 2000, 9000);
    if (tempErr) return fail(tempErr);

    const backend = parseBackend(args);
    if (isToolResult(backend)) return backend;

    const api = router.get(backend);
    await api.controlDevice(device.deviceId, device.model, { name: 'colorTem', value: temperature });
    return ok(`Color temperature set to ${temperature}K.`);
  }

  async function handleListScenes(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if (isToolResult(device)) return device;

    const api = router.get('v2');
    if (!api.listScenes) return fail('list_scenes is only available with the v2 backend');

    const scenes = await api.listScenes(device.deviceId, device.model);
    return ok(JSON.stringify(scenes, null, 2));
  }

  async function handleListDiyScenes(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if (isToolResult(device)) return device;

    const api = router.get('v2');
    if (!api.listDiyScenes) return fail('list_diy_scenes is only available with the v2 backend');

    const scenes = await api.listDiyScenes(device.deviceId, device.model);
    return ok(JSON.stringify(scenes, null, 2));
  }

  async function handleActivateScene(args: Record<string, unknown>): Promise<ToolResult> {
    const device = parseDevice(args);
    if (isToolResult(device)) return device;

    const sceneName = args.scene_name as string | undefined;
    const sceneType = args.scene_type as string | undefined;
    if (!sceneName) return fail('scene_name is required');
    if (sceneType !== 'light' && sceneType !== 'diy') return fail("scene_type must be 'light' or 'diy'");

    const api = router.get('v2');
    if (!api.activateScene) return fail('activate_scene is only available with the v2 backend');

    const isDiy = sceneType === 'diy';
    const listFn = isDiy ? api.listDiyScenes : api.listScenes;
    if (!listFn) return fail('activate_scene is only available with the v2 backend');

    const scenes = await listFn(device.deviceId, device.model);
    const label = isDiy ? 'DIY scene' : 'Scene';
    const scene = scenes.find((s) => s.name === sceneName);
    if (!scene) return fail(`${label} '${sceneName}' not found`);

    await api.activateScene(device.deviceId, device.model, {
      type: 'devices.capabilities.dynamic_scene',
      instance: isDiy ? 'diyScene' : 'lightScene',
      value: scene.value,
    });
    return ok(`${label} '${sceneName}' activated.`);
  }

  return {
    list_devices: handleListDevices,
    get_device_state: handleGetDeviceState,
    set_power: handleSetPower,
    set_brightness: handleSetBrightness,
    set_color: handleSetColor,
    set_color_temperature: handleSetColorTemperature,
    list_scenes: handleListScenes,
    list_diy_scenes: handleListDiyScenes,
    activate_scene: handleActivateScene,
  };
}
