import { describe, expect, test } from 'vitest';
import * as oracle from '../../src/oracle.js';

describe('concierge entrypoint exports', () => {
  test('exposes core helpers', () => {
    expect(oracle.DEFAULT_MODEL).toBeDefined();
    expect(typeof oracle.buildPrompt).toBe('function');
    expect(typeof oracle.renderPromptMarkdown).toBe('function');
    expect(typeof oracle.formatFileSection).toBe('function');
    expect(oracle.PRO_MODELS instanceof Set).toBe(true);
  });
});
