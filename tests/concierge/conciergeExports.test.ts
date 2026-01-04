import { describe, expect, test } from 'vitest';
import * as concierge from '../../src/concierge.js';

describe('concierge entrypoint exports', () => {
  test('exposes core helpers', () => {
    expect(concierge.DEFAULT_MODEL).toBeDefined();
    expect(typeof concierge.buildPrompt).toBe('function');
    expect(typeof concierge.renderPromptMarkdown).toBe('function');
    expect(typeof concierge.formatFileSection).toBe('function');
    expect(concierge.PRO_MODELS instanceof Set).toBe(true);
  });
});
