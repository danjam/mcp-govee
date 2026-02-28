# MCP Govee

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that lets AI assistants control your Govee smart devices. Turn devices on and off, change colors, adjust brightness, and more — all through natural conversation.

Works with Claude Desktop, Claude Code, or any MCP-compatible client.

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

## What You Can Do

### List Devices

See all the Govee devices on your account, including their IDs, models, and what commands they support. This is the starting point — you'll need a device's ID and model for all other commands.

### Get Device State

Check the current state of a device: whether it's on or off, the brightness level, and the current color.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID (from list devices) |
| `model` | Yes | The device model (from list devices) |

### Set Power

Turn a device on or off.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |
| `state` | Yes | `on` or `off` |

### Set Brightness

Adjust a device's brightness level.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |
| `brightness` | Yes | An integer from 0 to 100 |

### Set Color

Set a device to a specific color using RGB values.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |
| `r` | Yes | Red, integer (0–255) |
| `g` | Yes | Green, integer (0–255) |
| `b` | Yes | Blue, integer (0–255) |

### Set Color Temperature

Set a device to a warm or cool white using color temperature.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `device_id` | Yes | The device ID |
| `model` | Yes | The device model |
| `temperature` | Yes | Integer in Kelvin (2000 = warm, 9000 = cool daylight) |

## Good to Know

- Not all Govee devices support every command. Use **list devices** to check what each device supports.
- The [Govee API](https://developer-api.govee.com/docs) has rate limits. If you're sending many commands quickly, you may see errors — just wait a moment and try again.
- Only devices added to your Govee Home app will appear.

## License

MIT
