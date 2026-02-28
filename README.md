# MCP Govee

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets AI assistants control your Govee smart devices. Turn lights on and off, change colors, adjust brightness, activate scenes, and more — all through natural conversation.

Works with Claude Desktop, Claude Code, or any MCP-compatible client.

---

## Setup

### 1. Get a Govee API Key

Open the **Govee Home** app on your phone and go to **Settings → About Us → Apply for API Key**. You'll receive your key by email.

### 2. Configure Your MCP Client

Add the server to your MCP client's configuration. There are two ways to do this:

**Option A: Run directly from GitHub (no install needed)**

```json
{
  "mcpServers": {
    "govee": {
      "command": "npx",
      "args": ["-y", "github:danjam/mcp-govee"],
      "env": {
        "GOVEE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

**Option B: Clone and run locally**

```bash
git clone https://github.com/danjam/mcp-govee.git
cd mcp-govee
npm install
```

Then point your MCP client at the local build:

```json
{
  "mcpServers": {
    "govee": {
      "command": "node",
      "args": ["/path/to/mcp-govee/dist/index.js"],
      "env": {
        "GOVEE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Replace `/path/to/mcp-govee` with the actual path where you cloned the project.

---

## Backends

The server supports three different ways to communicate with your Govee devices. By default it uses **v1**, which works for most people out of the box.

| Backend | How it connects | Scenes support | Notes |
|---------|----------------|----------------|-------|
| **v1** (default) | Govee cloud API | No | Simplest setup, works with all Govee devices |
| **v2** | Govee cloud API (newer) | Yes | Required for scenes; supports the same devices as v1. **Much stricter rate limit** (see below) |
| **lan** | Local network (UDP) | No | Fastest, no internet needed, no rate limits, but only works with [LAN-capable devices](https://app-h5.govee.com/user-manual/wlan-guide) on the same network. You must enable LAN control per device in the Govee Home app (device settings → LAN Control) |

> [!WARNING]
> **v2 has a much stricter rate limit.** The v1 API allows **100 requests per minute**, but the v2 API only allows **10 requests per minute** — that's one request every 6 seconds. We recommend leaving v1 as the default and only using v2 when you need scene features.

To change the default backend, add `GOVEE_API_BACKEND` to your config:

```json
{
  "mcpServers": {
    "govee": {
      "command": "npx",
      "args": ["-y", "github:danjam/mcp-govee"],
      "env": {
        "GOVEE_API_KEY": "your-api-key-here",
        "GOVEE_API_BACKEND": "v2"
      }
    }
  }
}
```

To enable the LAN backend, also set `GOVEE_LAN_ENABLED`:

```json
"env": {
  "GOVEE_API_KEY": "your-api-key-here",
  "GOVEE_LAN_ENABLED": "true"
}
```

You can also override the backend on a per-command basis — every tool accepts an optional `backend` parameter (`v1`, `v2`, or `lan`). This lets you use v1 as your default while still accessing v2-only features like scenes when you need them. You don't need to set v2 as your default to use scenes — the server will automatically route scene commands to v2.

---

## What You Can Do

### List Devices

See all the Govee devices on your account, including their IDs, models, and what commands they support. This is the starting point — you'll need a device's ID and model for all other commands. Only devices added to your Govee Home app will appear, and not all devices support every command.

Tool: `list_devices`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `backend` | No | Override the default backend (`v1`, `v2`, or `lan`) |

### Get Device State

Check the current state of a device: whether it's on or off, the brightness level, and the current color.

Tool: `get_device_state`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID (from list devices) |
| `model` | Yes | The device model (from list devices) |
| `backend` | No | Override the default backend |

### Set Power

Turn a device on or off.

Tool: `set_power`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |
| `state` | Yes | `on` or `off` |
| `backend` | No | Override the default backend |

### Set Brightness

Adjust a device's brightness level.

Tool: `set_brightness`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |
| `brightness` | Yes | An integer from 0 to 100 |
| `backend` | No | Override the default backend |

### Set Color

Set a device to a specific color using RGB values.

Tool: `set_color`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |
| `r` | Yes | Red, integer (0–255) |
| `g` | Yes | Green, integer (0–255) |
| `b` | Yes | Blue, integer (0–255) |
| `backend` | No | Override the default backend |

### Set Color Temperature

Set a device to a warm or cool white using color temperature.

Tool: `set_color_temperature`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |
| `temperature` | Yes | Integer in Kelvin (2000 = warm, 9000 = cool daylight) |
| `backend` | No | Override the default backend |

### List Scenes

List the built-in light scenes available for a device (e.g. "Rainbow", "Candlelight", "Ocean"). Use this to see what scene names you can activate. **Requires the v2 backend.**

Tool: `list_scenes`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |

### List DIY Scenes

List the custom scenes you've created in the Govee Home app. **Requires the v2 backend.**

Tool: `list_diy_scenes`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |

### Activate Scene

Activate a built-in or DIY scene by name. Use **list scenes** or **list DIY scenes** first to see available names. **Requires the v2 backend.**

Tool: `activate_scene`

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |
| `scene_name` | Yes | The name of the scene to activate (exact match from the list) |
| `scene_type` | Yes | `light` for built-in scenes, `diy` for your custom scenes |

---

## License

[MIT](LICENSE)
