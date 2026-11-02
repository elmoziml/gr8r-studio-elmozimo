export const API_CONFIG = {
  mode: import.meta.env.VITE_API_MODE || 'file',
  baseUrl: import.meta.env.VITE_API_BASE_URL || '',
  latency: Number(import.meta.env.VITE_API_LATENCY || 0),
  storageKey: 'gr8r.api.v1',
  legacyStorageKey: 'gr8r.v2',
};
