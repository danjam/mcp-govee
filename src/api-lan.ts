import { createSocket, type Socket } from 'node:dgram';
import type { Api, GoveeDevice, GoveeDeviceState, GoveeLanDevice } from './types.js';

const MULTICAST_ADDR = '239.255.255.250';
const SCAN_PORT = 4001;
const LISTEN_PORT = 4002;
const CONTROL_PORT = 4003;
const DISCOVERY_TIMEOUT_MS = 3000;
const CONTROL_TIMEOUT_MS = 3000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface DeviceCache {
  devices: GoveeLanDevice[];
  expiry: number;
}

export interface LanSocketFactory {
  createSocket(type: 'udp4'): Socket;
}

const defaultSocketFactory: LanSocketFactory = {
  createSocket: (type: 'udp4') => createSocket(type),
};

export function createLanApi(socketFactory: LanSocketFactory = defaultSocketFactory): Api {
  let cache: DeviceCache | undefined;
  let pending: Promise<GoveeLanDevice[]> | undefined;

  async function discover(): Promise<GoveeLanDevice[]> {
    if (cache && Date.now() < cache.expiry) return cache.devices;
    if (pending) return pending;

    pending = doDiscover().finally(() => {
      pending = undefined;
    });
    return pending;
  }

  function doDiscover(): Promise<GoveeLanDevice[]> {
    const devices: GoveeLanDevice[] = [];
    const seen = new Set<string>();

    return new Promise((resolve, reject) => {
      const listener = socketFactory.createSocket('udp4');
      let timeout: ReturnType<typeof setTimeout>;

      function cleanup(): void {
        clearTimeout(timeout);
        try {
          listener.close();
        } catch {}
      }

      listener.on('error', (err) => {
        cleanup();
        reject(err);
      });

      listener.on('message', (msg: Buffer) => {
        try {
          const data = JSON.parse(msg.toString()) as Record<string, unknown>;
          const msgData = data.msg as Record<string, unknown> | undefined;
          if (msgData?.cmd === 'scan' && msgData.data) {
            const d = msgData.data as Record<string, unknown>;
            const deviceId = d.device as string;
            if (deviceId && !seen.has(deviceId)) {
              seen.add(deviceId);
              devices.push({
                ip: d.ip as string,
                device: deviceId,
                sku: d.sku as string,
                bleVersionHard: (d.bleVersionHard as string) ?? '',
                bleVersionSoft: (d.bleVersionSoft as string) ?? '',
                wifiVersionHard: (d.wifiVersionHard as string) ?? '',
                wifiVersionSoft: (d.wifiVersionSoft as string) ?? '',
              });
            }
          }
        } catch {}
      });

      listener.bind(LISTEN_PORT, () => {
        const scanMsg = JSON.stringify({ msg: { cmd: 'scan', data: { account_topic: 'reserve' } } });
        const sender = socketFactory.createSocket('udp4');
        sender.send(scanMsg, SCAN_PORT, MULTICAST_ADDR, (err) => {
          sender.close();
          if (err) {
            cleanup();
            reject(err);
          }
        });

        timeout = setTimeout(() => {
          cleanup();
          cache = { devices, expiry: Date.now() + CACHE_TTL_MS };
          resolve(devices);
        }, DISCOVERY_TIMEOUT_MS);
      });
    });
  }

  function findDevice(devices: GoveeLanDevice[], deviceId: string): GoveeLanDevice {
    const d = devices.find((dev) => dev.device === deviceId);
    if (!d) throw new Error(`LAN device '${deviceId}' not found. Run list_devices first to discover devices.`);
    return d;
  }

  async function listDevices(): Promise<GoveeDevice[]> {
    const lanDevices = await discover();
    return lanDevices.map((d) => ({
      device: d.device,
      model: d.sku,
      deviceName: d.device,
      controllable: true,
      retrievable: false,
      supportCmds: ['turn', 'brightness', 'color', 'colorTem'],
    }));
  }

  async function getDeviceState(device: string, model: string): Promise<GoveeDeviceState> {
    const lanDevices = await discover();
    const lanDevice = findDevice(lanDevices, device);

    return new Promise((resolve, reject) => {
      const sock = socketFactory.createSocket('udp4');
      let timeout: ReturnType<typeof setTimeout>;

      function cleanup(): void {
        clearTimeout(timeout);
        try {
          sock.close();
        } catch {}
      }

      sock.on('error', (err) => {
        cleanup();
        reject(err);
      });

      sock.on('message', (msg: Buffer) => {
        try {
          const data = JSON.parse(msg.toString()) as Record<string, unknown>;
          const msgData = data.msg as Record<string, unknown> | undefined;
          if (msgData?.cmd === 'devStatus') {
            cleanup();
            const status = msgData.data as Record<string, unknown>;
            const properties: Record<string, unknown>[] = [];
            if (status.onOff !== undefined) properties.push({ powerState: status.onOff === 1 ? 'on' : 'off' });
            if (status.brightness !== undefined) properties.push({ brightness: status.brightness });
            if (status.color) properties.push({ color: status.color });
            if (status.colorTemInKelvin) properties.push({ colorTem: status.colorTemInKelvin });
            resolve({ device, model, properties });
          }
        } catch {}
      });

      sock.bind(() => {
        const devStatusMsg = JSON.stringify({ msg: { cmd: 'devStatus', data: {} } });
        sock.send(devStatusMsg, CONTROL_PORT, lanDevice.ip, (err) => {
          if (err) {
            cleanup();
            reject(err);
          }
        });

        timeout = setTimeout(() => {
          cleanup();
          reject(new Error(`Timeout waiting for device state from ${lanDevice.ip}`));
        }, CONTROL_TIMEOUT_MS);
      });
    });
  }

  function translateCmd(cmd: Record<string, unknown>): Record<string, unknown> {
    const name = cmd.name as string;
    const value = cmd.value;
    switch (name) {
      case 'turn':
        return { msg: { cmd: 'turn', data: { value: value === 'on' ? 1 : 0 } } };
      case 'brightness':
        return { msg: { cmd: 'brightness', data: { value } } };
      case 'color': {
        const c = value as { r: number; g: number; b: number };
        return { msg: { cmd: 'colorwc', data: { color: c, colorTemInKelvin: 0 } } };
      }
      case 'colorTem': {
        return { msg: { cmd: 'colorwc', data: { color: { r: 0, g: 0, b: 0 }, colorTemInKelvin: value } } };
      }
      default:
        throw new Error(`Unknown command: ${name}`);
    }
  }

  async function controlDevice(device: string, _model: string, cmd: Record<string, unknown>): Promise<unknown> {
    const lanDevices = await discover();
    const lanDevice = findDevice(lanDevices, device);
    const message = JSON.stringify(translateCmd(cmd));

    return new Promise<void>((resolve, reject) => {
      const sock = socketFactory.createSocket('udp4');
      sock.on('error', (err) => {
        sock.close();
        reject(err);
      });
      sock.send(message, CONTROL_PORT, lanDevice.ip, (err) => {
        sock.close();
        if (err) reject(err);
        else resolve();
      });
    });
  }

  return { listDevices, getDeviceState, controlDevice };
}
