import type { KnownModelName } from './types.js';
import { MODEL_CONFIGS } from './config.js';

export function isKnownModel(model: string): model is KnownModelName {
  return Object.hasOwn(MODEL_CONFIGS, model);
}

export function safeModelSlug(model: string): string {
  return model.replace(/[/\\]/g, '__').replace(/[:*?"<>|]/g, '_');
}
