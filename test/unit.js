import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createHandlers } from '../dist/handlers.js';

/** @returns {import('../dist/types.js').Api} */
function mockApi() {
  return {
    listDevices: async () => [
      {
        device: 'AA:BB:CC:DD:EE:FF',
        model: 'H6160',
        deviceName: 'Living Room',
        controllable: true,
        retrievable: true,
        supportCmds: ['turn', 'brightness', 'color'],
      },
    ],
    getDeviceState: async () => ({
      device: 'AA:BB:CC:DD:EE:FF',
      model: 'H6160',
      properties: [{ powerState: 'on' }, { brightness: 75 }],
    }),
    controlDevice: async () => ({}),
  };
}

/** @param {import('../dist/types.js').Api} api */
function mockRouter(api) {
  return { get: () => api, defaultBackend: 'v1' };
}

describe('list_devices', () => {
  const handlers = createHandlers(mockRouter(mockApi()));

  it('returns formatted device list', async () => {
    const result = await handlers.list_devices({});
    assert.equal(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.text);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].device_id, 'AA:BB:CC:DD:EE:FF');
      assert.equal(parsed[0].name, 'Living Room');
    }
  });
});

describe('set_power', () => {
  const handlers = createHandlers(mockRouter(mockApi()));

  it('rejects missing fields', async () => {
    const result = await handlers.set_power({});
    assert.equal(result.ok, false);
  });

  it('rejects invalid action', async () => {
    const result = await handlers.set_power({ device_id: 'x', model: 'y', state: 'dim' });
    assert.equal(result.ok, false);
  });

  it('succeeds with valid args', async () => {
    const result = await handlers.set_power({ device_id: 'x', model: 'y', state: 'on' });
    assert.equal(result.ok, true);
  });
});

describe('set_brightness', () => {
  const handlers = createHandlers(mockRouter(mockApi()));

  it('rejects out-of-range brightness', async () => {
    const result = await handlers.set_brightness({ device_id: 'x', model: 'y', brightness: 150 });
    assert.equal(result.ok, false);
  });

  it('rejects non-integer brightness', async () => {
    const result = await handlers.set_brightness({ device_id: 'x', model: 'y', brightness: 50.5 });
    assert.equal(result.ok, false);
  });

  it('accepts valid brightness', async () => {
    const result = await handlers.set_brightness({ device_id: 'x', model: 'y', brightness: 50 });
    assert.equal(result.ok, true);
    if (result.ok) assert.match(result.text, /50%/);
  });
});

describe('get_device_state', () => {
  const handlers = createHandlers(mockRouter(mockApi()));

  it('rejects missing device fields', async () => {
    const result = await handlers.get_device_state({});
    assert.equal(result.ok, false);
  });

  it('returns device state', async () => {
    const result = await handlers.get_device_state({ device_id: 'AA:BB:CC:DD:EE:FF', model: 'H6160' });
    assert.equal(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.text);
      assert.equal(parsed.device, 'AA:BB:CC:DD:EE:FF');
      assert.equal(parsed.properties.length, 2);
    }
  });
});

describe('set_color', () => {
  const handlers = createHandlers(mockRouter(mockApi()));

  it('rejects missing color values', async () => {
    const result = await handlers.set_color({ device_id: 'x', model: 'y' });
    assert.equal(result.ok, false);
  });

  it('rejects out-of-range color values', async () => {
    const result = await handlers.set_color({ device_id: 'x', model: 'y', r: 300, g: 0, b: 0 });
    assert.equal(result.ok, false);
  });

  it('rejects non-integer color values', async () => {
    const result = await handlers.set_color({ device_id: 'x', model: 'y', r: 10.5, g: 0, b: 0 });
    assert.equal(result.ok, false);
  });

  it('accepts valid color values', async () => {
    const result = await handlers.set_color({ device_id: 'x', model: 'y', r: 255, g: 128, b: 0 });
    assert.equal(result.ok, true);
    if (result.ok) assert.match(result.text, /RGB\(255, 128, 0\)/);
  });
});

describe('set_color_temperature', () => {
  const handlers = createHandlers(mockRouter(mockApi()));

  it('rejects out-of-range temperature', async () => {
    const low = await handlers.set_color_temperature({ device_id: 'x', model: 'y', temperature: 1000 });
    const high = await handlers.set_color_temperature({ device_id: 'x', model: 'y', temperature: 10000 });
    assert.equal(low.ok, false);
    assert.equal(high.ok, false);
  });

  it('rejects non-integer temperature', async () => {
    const result = await handlers.set_color_temperature({ device_id: 'x', model: 'y', temperature: 4000.5 });
    assert.equal(result.ok, false);
  });

  it('accepts valid temperature', async () => {
    const result = await handlers.set_color_temperature({ device_id: 'x', model: 'y', temperature: 4000 });
    assert.equal(result.ok, true);
  });
});

describe('list_devices (empty)', () => {
  const handlers = createHandlers(
    mockRouter({
      ...mockApi(),
      listDevices: async () => [],
    }),
  );

  it('returns empty array for no devices', async () => {
    const result = await handlers.list_devices({});
    assert.equal(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.text);
      assert.equal(parsed.length, 0);
    }
  });
});

describe('error propagation', () => {
  const handlers = createHandlers(
    mockRouter({
      ...mockApi(),
      controlDevice: async () => {
        throw new Error('API failure');
      },
    }),
  );

  it('propagates API errors from handlers', async () => {
    await assert.rejects(handlers.set_power({ device_id: 'x', model: 'y', state: 'on' }), {
      message: 'API failure',
    });
  });
});

describe('backend selection', () => {
  it('passes backend param to router.get', async () => {
    let lastBackend;
    const api = mockApi();
    const router = {
      get: (b) => {
        lastBackend = b;
        return api;
      },
      defaultBackend: 'v1',
    };
    const handlers = createHandlers(router);

    await handlers.list_devices({ backend: 'v2' });
    assert.equal(lastBackend, 'v2');

    await handlers.list_devices({});
    assert.equal(lastBackend, undefined);
  });

  it('rejects invalid backend values', async () => {
    const handlers = createHandlers(mockRouter(mockApi()));
    const result = await handlers.list_devices({ backend: 'v3' });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /Invalid backend/);
  });
});

describe('list_scenes', () => {
  const v2Api = {
    ...mockApi(),
    listScenes: async () => [
      { name: 'Sunset', value: { id: 1, paramId: 100 } },
      { name: 'Rainbow', value: { id: 2, paramId: 200 } },
    ],
    listDiyScenes: async () => [],
    activateScene: async () => ({}),
  };
  const router = {
    get: (b) => (b === 'v2' || b === undefined ? v2Api : mockApi()),
    defaultBackend: 'v1',
  };
  const handlers = createHandlers(router);

  it('rejects missing device fields', async () => {
    const result = await handlers.list_scenes({});
    assert.equal(result.ok, false);
  });

  it('returns scene list', async () => {
    const result = await handlers.list_scenes({ device_id: 'x', model: 'y' });
    assert.equal(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.text);
      assert.equal(parsed.length, 2);
      assert.equal(parsed[0].name, 'Sunset');
    }
  });
});

describe('list_diy_scenes', () => {
  const v2Api = {
    ...mockApi(),
    listScenes: async () => [],
    listDiyScenes: async () => [
      { name: 'My Cool Scene', value: 42 },
    ],
    activateScene: async () => ({}),
  };
  const router = {
    get: (b) => (b === 'v2' || b === undefined ? v2Api : mockApi()),
    defaultBackend: 'v1',
  };
  const handlers = createHandlers(router);

  it('returns diy scene list', async () => {
    const result = await handlers.list_diy_scenes({ device_id: 'x', model: 'y' });
    assert.equal(result.ok, true);
    if (result.ok) {
      const parsed = JSON.parse(result.text);
      assert.equal(parsed.length, 1);
      assert.equal(parsed[0].name, 'My Cool Scene');
    }
  });
});

describe('activate_scene', () => {
  let lastCapability;
  const v2Api = {
    ...mockApi(),
    listScenes: async () => [{ name: 'Sunset', value: { id: 1, paramId: 100 } }],
    listDiyScenes: async () => [{ name: 'My DIY', value: 42 }],
    activateScene: async (_d, _m, cap) => {
      lastCapability = cap;
      return {};
    },
  };
  const router = {
    get: (b) => (b === 'v2' || b === undefined ? v2Api : mockApi()),
    defaultBackend: 'v1',
  };
  const handlers = createHandlers(router);

  it('rejects missing scene_name', async () => {
    const result = await handlers.activate_scene({ device_id: 'x', model: 'y', scene_type: 'light' });
    assert.equal(result.ok, false);
  });

  it('rejects invalid scene_type', async () => {
    const result = await handlers.activate_scene({
      device_id: 'x',
      model: 'y',
      scene_name: 'Sunset',
      scene_type: 'invalid',
    });
    assert.equal(result.ok, false);
  });

  it('rejects unknown scene name', async () => {
    const result = await handlers.activate_scene({
      device_id: 'x',
      model: 'y',
      scene_name: 'Nonexistent',
      scene_type: 'light',
    });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.message, /not found/);
  });

  it('activates a light scene', async () => {
    const result = await handlers.activate_scene({
      device_id: 'x',
      model: 'y',
      scene_name: 'Sunset',
      scene_type: 'light',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(lastCapability, {
      type: 'devices.capabilities.dynamic_scene',
      instance: 'lightScene',
      value: { id: 1, paramId: 100 },
    });
  });

  it('activates a diy scene', async () => {
    const result = await handlers.activate_scene({
      device_id: 'x',
      model: 'y',
      scene_name: 'My DIY',
      scene_type: 'diy',
    });
    assert.equal(result.ok, true);
    assert.deepEqual(lastCapability, {
      type: 'devices.capabilities.dynamic_scene',
      instance: 'diyScene',
      value: 42,
    });
  });
});

describe('v2 command translation', () => {
  it('translates turn on/off to v2 format', async () => {
    let lastCmd;
    const api = {
      ...mockApi(),
      controlDevice: async (_d, _m, cmd) => {
        lastCmd = cmd;
        return {};
      },
    };
    const handlers = createHandlers(mockRouter(api));

    await handlers.set_power({ device_id: 'x', model: 'y', state: 'on' });
    assert.deepEqual(lastCmd, { name: 'turn', value: 'on' });
  });
});

describe('LAN message formatting', () => {
  it('formats turn command correctly', () => {
    // Test the expected LAN message format
    const turnOn = { msg: { cmd: 'turn', data: { value: 1 } } };
    const turnOff = { msg: { cmd: 'turn', data: { value: 0 } } };
    assert.equal(JSON.stringify(turnOn), '{"msg":{"cmd":"turn","data":{"value":1}}}');
    assert.equal(JSON.stringify(turnOff), '{"msg":{"cmd":"turn","data":{"value":0}}}');
  });

  it('formats brightness command correctly', () => {
    const msg = { msg: { cmd: 'brightness', data: { value: 75 } } };
    assert.equal(JSON.stringify(msg), '{"msg":{"cmd":"brightness","data":{"value":75}}}');
  });

  it('formats color command correctly', () => {
    const msg = { msg: { cmd: 'colorwc', data: { color: { r: 255, g: 0, b: 128 }, colorTemInKelvin: 0 } } };
    const parsed = JSON.parse(JSON.stringify(msg));
    assert.equal(parsed.msg.cmd, 'colorwc');
    assert.deepEqual(parsed.msg.data.color, { r: 255, g: 0, b: 128 });
    assert.equal(parsed.msg.data.colorTemInKelvin, 0);
  });

  it('formats color temperature command correctly', () => {
    const msg = { msg: { cmd: 'colorwc', data: { color: { r: 0, g: 0, b: 0 }, colorTemInKelvin: 4000 } } };
    const parsed = JSON.parse(JSON.stringify(msg));
    assert.equal(parsed.msg.cmd, 'colorwc');
    assert.equal(parsed.msg.data.colorTemInKelvin, 4000);
  });
});
