import type { MCPToolDefinition } from './types.js';

export const tools = [
  {
    name: 'list_devices',
    description: 'List all Govee devices on your account',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_device_state',
    description: 'Get the current state of a Govee device (power, brightness, color)',
    inputSchema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device MAC address / ID (from list_devices)' },
        model: { type: 'string', description: 'The device model (from list_devices)' },
      },
      required: ['device_id', 'model'],
    },
  },
  {
    name: 'set_power',
    description: 'Turn a Govee device on or off',
    inputSchema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device MAC address / ID' },
        model: { type: 'string', description: 'The device model' },
        state: { type: 'string', enum: ['on', 'off'], description: "Power state: 'on' or 'off'" },
      },
      required: ['device_id', 'model', 'state'],
    },
  },
  {
    name: 'set_brightness',
    description: 'Set the brightness of a Govee device (0-100)',
    inputSchema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device MAC address / ID' },
        model: { type: 'string', description: 'The device model' },
        brightness: { type: 'integer', minimum: 0, maximum: 100, description: 'Brightness level (0-100)' },
      },
      required: ['device_id', 'model', 'brightness'],
    },
  },
  {
    name: 'set_color',
    description: 'Set the color of a Govee device using RGB values',
    inputSchema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device MAC address / ID' },
        model: { type: 'string', description: 'The device model' },
        r: { type: 'integer', minimum: 0, maximum: 255, description: 'Red value (0-255)' },
        g: { type: 'integer', minimum: 0, maximum: 255, description: 'Green value (0-255)' },
        b: { type: 'integer', minimum: 0, maximum: 255, description: 'Blue value (0-255)' },
      },
      required: ['device_id', 'model', 'r', 'g', 'b'],
    },
  },
  {
    name: 'set_color_temperature',
    description: 'Set the color temperature of a Govee device in Kelvin (2000-9000)',
    inputSchema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device MAC address / ID' },
        model: { type: 'string', description: 'The device model' },
        temperature: {
          type: 'integer',
          minimum: 2000,
          maximum: 9000,
          description: 'Color temperature in Kelvin (2000-9000)',
        },
      },
      required: ['device_id', 'model', 'temperature'],
    },
  },
] satisfies MCPToolDefinition[];
