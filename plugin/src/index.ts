import type { PluginAPI } from './types.js';

export const id = 'sophon';
export const name = 'Sophon - Humanities Companion';

export function register(api: PluginAPI) {
  // Tools will be registered in subsequent tasks
  console.log('[Sophon] Plugin loaded');
}
