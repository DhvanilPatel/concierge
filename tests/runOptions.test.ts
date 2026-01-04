import { describe, expect, it } from 'vitest';
import { resolveRunOptionsFromConfig } from '../src/cli/runOptions.js';
import { DEFAULT_MODEL } from '../src/concierge/config.js';

const basePrompt = 'This prompt is comfortably above twenty characters.';

describe('resolveRunOptionsFromConfig', () => {
  it('defaults to gpt-5.2-pro when model not provided', () => {
    const { runOptions } = resolveRunOptionsFromConfig({ prompt: basePrompt });
    expect(runOptions.model).toBe(DEFAULT_MODEL);
  });

  it('uses config model when caller does not provide one', () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      userConfig: { model: 'gpt-5.1' },
    });
    expect(runOptions.model).toBe('gpt-5.2');
  });

  it('appends prompt suffix from config', () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: 'Hi there, this exceeds twenty characters.',
      userConfig: { promptSuffix: '// signed' },
    });
    expect(runOptions.prompt).toBe('Hi there, this exceeds twenty characters.\n// signed');
  });

  it('uses heartbeatSeconds from config', () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      userConfig: { heartbeatSeconds: 5 },
    });
    expect(runOptions.heartbeatIntervalMs).toBe(5000);
  });

  it('maps browser model aliases for GPT to the latest ChatGPT targets', () => {
    const gptBase = resolveRunOptionsFromConfig({ prompt: basePrompt, model: 'gpt-5.1' });
    expect(gptBase.runOptions.model).toBe('gpt-5.2');

    const gptPro = resolveRunOptionsFromConfig({ prompt: basePrompt, model: 'gpt-5.1-pro' });
    expect(gptPro.runOptions.model).toBe('gpt-5.2-pro');
  });

  it('accepts gemini models for browser runs', () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      model: 'gemini-3-pro',
    });
    expect(runOptions.model).toBe('gemini-3-pro');
  });

  it('rejects multi-model lists', () => {
    expect(() =>
      resolveRunOptionsFromConfig({
        prompt: basePrompt,
        models: ['gpt-5.1', 'gemini-3-pro'],
      }),
    ).toThrow(/Multi-model runs are no longer supported/);
  });

  it('rejects non-browser models', () => {
    expect(() =>
      resolveRunOptionsFromConfig({
        prompt: basePrompt,
        model: 'claude-4.5-sonnet',
      }),
    ).toThrow(/Browser engine only supports GPT and Gemini/);
  });
});
