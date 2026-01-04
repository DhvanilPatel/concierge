import { describe, expect, it } from 'vitest';
import { resolveEngine, defaultWaitPreference, type EngineMode } from '../src/cli/engine.js';

// biome-ignore lint/style/useNamingConvention: env var names are uppercase with underscores
const envWithKey = { ...process.env, OPENAI_API_KEY: 'sk-test' } as NodeJS.ProcessEnv;
const envWithoutKey = { ...process.env } as NodeJS.ProcessEnv;
delete envWithoutKey.OPENAI_API_KEY;

describe('resolveEngine', () => {
  it('always resolves to browser in browser-only builds', () => {
    const engine1 = resolveEngine({ engine: undefined, browserFlag: false, env: envWithKey });
    const engine2 = resolveEngine({ engine: 'api' as EngineMode, browserFlag: false, env: envWithoutKey });
    const engine3 = resolveEngine({ engine: 'browser' as EngineMode, browserFlag: true, env: envWithoutKey });
    expect(engine1).toBe<EngineMode>('browser');
    expect(engine2).toBe<EngineMode>('browser');
    expect(engine3).toBe<EngineMode>('browser');
  });
});

describe('defaultWaitPreference', () => {
  it('defaults to waiting for browser runs', () => {
    expect(defaultWaitPreference('gpt-5.2-pro', 'browser')).toBe(true);
    expect(defaultWaitPreference('gemini-3-pro', 'browser')).toBe(true);
    expect(defaultWaitPreference('gpt-5.2-pro', 'api')).toBe(true);
  });
});
