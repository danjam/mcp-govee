import { createLanApi } from './api-lan.js';
import { createV1Api } from './api-v1.js';
import { createV2Api } from './api-v2.js';
import type { Api, ApiRouter, Backend } from './types.js';

export interface ApiRouterConfig {
  apiKey: string;
  defaultBackend?: Backend;
  lanEnabled?: boolean;
}

export function createApiRouter(config: ApiRouterConfig): ApiRouter {
  const defaultBackend = config.defaultBackend ?? 'v1';
  const backends = new Map<Backend, Api>();

  backends.set('v1', createV1Api(config.apiKey));
  backends.set('v2', createV2Api(config.apiKey));
  if (config.lanEnabled) {
    backends.set('lan', createLanApi());
  }

  function get(backend?: Backend): Api {
    const key = backend ?? defaultBackend;
    const api = backends.get(key);
    if (!api) throw new Error(`Backend '${key}' is not enabled`);
    return api;
  }

  return { get, defaultBackend };
}
