import os from 'node:os';
import path from 'node:path';

let conciergeHomeDirOverride: string | null = null;

/**
 * Test-only hook: avoid mutating process.env (shared across Vitest worker threads).
 * This override is scoped to the current Node worker.
 */
export function setConciergeHomeDirOverrideForTest(dir: string | null): void {
  conciergeHomeDirOverride = dir;
}

export function getConciergeHomeDir(): string {
  // Support legacy ORACLE_HOME_DIR for backwards compatibility
  return conciergeHomeDirOverride ?? process.env.CONCIERGE_HOME_DIR ?? process.env.ORACLE_HOME_DIR ?? path.join(os.homedir(), '.concierge');
}

// Legacy aliases for backwards compatibility
export const setOracleHomeDirOverrideForTest = setConciergeHomeDirOverrideForTest;
export const getOracleHomeDir = getConciergeHomeDir;

