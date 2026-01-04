import process from 'node:process';
import {
  startOscProgress as startOscProgressShared,
  supportsOscProgress as supportsOscProgressShared,
  type OscProgressOptions as OscProgressOptionsShared,
} from 'osc-progress';

export type OscProgressOptions = OscProgressOptionsShared;

export function supportsOscProgress(
  env: NodeJS.ProcessEnv = process.env,
  isTty: boolean = process.stdout.isTTY,
): boolean {
  if (
    env.CODEX_MANAGED_BY_NPM === '1' &&
    env.CONCIERGE_FORCE_OSC_PROGRESS !== '1'
  ) {
    return false;
  }
  return supportsOscProgressShared(env, isTty, {
    disableEnvVar: 'CONCIERGE_NO_OSC_PROGRESS',
    forceEnvVar: 'CONCIERGE_FORCE_OSC_PROGRESS',
  });
}

export function startOscProgress(options: OscProgressOptions = {}): () => void {
  const env = options.env ?? process.env;
  if (
    env.CODEX_MANAGED_BY_NPM === '1' &&
    env.CONCIERGE_FORCE_OSC_PROGRESS !== '1'
  ) {
    return () => {};
  }
  return startOscProgressShared({
    ...options,
    // Preserve Concierge's previous default: progress emits to stdout.
    write: options.write ?? ((text) => process.stdout.write(text)),
    env,
    disableEnvVar: 'CONCIERGE_NO_OSC_PROGRESS',
    forceEnvVar: 'CONCIERGE_FORCE_OSC_PROGRESS',
  });
}
