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

describe('list_devices', () => {
  const handlers = createHandlers(mockApi());

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
  const handlers = createHandlers(mockApi());

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
  const handlers = createHandlers(mockApi());

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
  const handlers = createHandlers(mockApi());

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
  const handlers = createHandlers(mockApi());

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
  const handlers = createHandlers(mockApi());

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
  const handlers = createHandlers({
    ...mockApi(),
    listDevices: async () => [],
  });

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
  const handlers = createHandlers({
    ...mockApi(),
    controlDevice: async () => {
      throw new Error('API failure');
    },
  });

  it('propagates API errors from handlers', async () => {
    await assert.rejects(
      handlers.set_power({ device_id: 'x', model: 'y', state: 'on' }),
      { message: 'API failure' },
    );
  });
});
