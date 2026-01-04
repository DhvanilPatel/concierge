import type { RunOracleOptions, ModelName } from '../oracle.js';
import { DEFAULT_MODEL } from '../oracle.js';
import type { UserConfig } from '../config.js';
import type { EngineMode } from './engine.js';
import { normalizeModelOption, inferModelFromLabel } from './options.js';
import { PromptValidationError } from '../oracle/errors.js';
import { normalizeChatGptModelForBrowser } from './browserConfig.js';

export interface ResolveRunOptionsInput {
  prompt: string;
  files?: string[];
  model?: string;
  models?: string[];
  engine?: EngineMode;
  userConfig?: UserConfig;
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedRunOptions {
  runOptions: RunOracleOptions;
  resolvedEngine: EngineMode;
  engineCoercedToApi?: boolean;
}

export function resolveRunOptionsFromConfig({
  prompt,
  files = [],
  model,
  models,
  engine,
  userConfig,
}: ResolveRunOptionsInput): ResolvedRunOptions {
  void engine;
  const resolvedEngine: EngineMode = 'browser';
  const requestedModelList = Array.isArray(models) ? models : [];
  const normalizedRequestedModels = requestedModelList.map((entry) => normalizeModelOption(entry)).filter(Boolean);

  if (normalizedRequestedModels.length > 1) {
    throw new PromptValidationError(
      'Multi-model runs are no longer supported in the browser-only build. Provide a single model instead.',
      { engine: 'browser', models: normalizedRequestedModels },
    );
  }

  const cliModelArg = normalizeModelOption(model ?? userConfig?.model) || DEFAULT_MODEL;
  const inferredModel = inferModelFromLabel(cliModelArg);
  const resolvedModel = normalizeChatGptModelForBrowser(inferredModel);
  const chosenModel = normalizedRequestedModels.length > 0
    ? normalizeChatGptModelForBrowser(inferModelFromLabel(normalizedRequestedModels[0]))
    : resolvedModel;

  const isBrowserCompatible = (m: string) => m.startsWith('gpt-') || m.startsWith('gemini');
  if (!isBrowserCompatible(chosenModel)) {
    throw new PromptValidationError(
      'Browser engine only supports GPT and Gemini models.',
      { engine: 'browser', models: [chosenModel] },
    );
  }

  const promptWithSuffix =
    userConfig?.promptSuffix && userConfig.promptSuffix.trim().length > 0
      ? `${prompt.trim()}\n${userConfig.promptSuffix}`
      : prompt;

  const heartbeatIntervalMs =
    userConfig?.heartbeatSeconds !== undefined ? userConfig.heartbeatSeconds * 1000 : 30_000;

  const runOptions: RunOracleOptions = {
    prompt: promptWithSuffix,
    model: chosenModel as ModelName,
    file: files ?? [],
    heartbeatIntervalMs,
  };

  return { runOptions, resolvedEngine };
}
