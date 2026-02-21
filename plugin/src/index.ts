import type { PluginAPI } from './types.js';
import { registerAllTools } from './tools/register.js';

export const id = 'sophon';
export const name = 'Sophon - Humanities Companion';

export function register(api: PluginAPI) {
  registerAllTools(api);
  console.log('[Sophon] Plugin loaded successfully');
}
