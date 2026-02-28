import { BACKENDS, type MCPToolDefinition } from './types.js';

const backendProp = {
  type: 'string',
  enum: [...BACKENDS],
  description: "API backend to use: 'v1' (default), 'v2', or 'lan'. Omit to use the server default.",
};

export const tools = [
  {
    name: 'list_devices',
    description: 'List all Govee devices on your account',
    inputSchema: {
      type: 'object',
      properties: {
        backend: backendProp,
      },
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
        backend: backendProp,
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
        backend: backendProp,
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
        backend: backendProp,
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
        backend: backendProp,
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
        backend: backendProp,
      },
      required: ['device_id', 'model', 'temperature'],
    },
  },
  {
    name: 'list_scenes',
    description: 'List built-in dynamic light scenes available for a device (v2 backend only)',
    inputSchema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device MAC address / ID' },
        model: { type: 'string', description: 'The device model' },
      },
      required: ['device_id', 'model'],
    },
  },
  {
    name: 'list_diy_scenes',
    description: 'List user-created DIY scenes for a device (v2 backend only)',
    inputSchema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device MAC address / ID' },
        model: { type: 'string', description: 'The device model' },
      },
      required: ['device_id', 'model'],
    },
  },
  {
    name: 'activate_scene',
    description: 'Activate a built-in or DIY scene by name (v2 backend only)',
    inputSchema: {
      type: 'object',
      properties: {
        device_id: { type: 'string', description: 'The device MAC address / ID' },
        model: { type: 'string', description: 'The device model' },
        scene_name: { type: 'string', description: 'The name of the scene to activate' },
        scene_type: {
          type: 'string',
          enum: ['light', 'diy'],
          description: "Scene type: 'light' for built-in scenes, 'diy' for user-created scenes",
        },
      },
      required: ['device_id', 'model', 'scene_name', 'scene_type'],
    },
  },
] satisfies MCPToolDefinition[];
