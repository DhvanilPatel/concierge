import kleur from 'kleur';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  SessionMetadata,
  SessionMode,
  BrowserSessionConfig,
  BrowserRuntimeMetadata,
} from '../sessionStore.js';
import type { RunOracleOptions } from '../oracle.js';
import { runBrowserSessionExecution, type BrowserSessionRunnerDeps } from '../browser/sessionRunner.js';
import { markErrorLogged } from './errorUtils.js';
import {
  type NotificationSettings,
  sendSessionNotification,
  deriveNotificationSettingsFromMetadata,
} from './notifier.js';
import { sessionStore } from '../sessionStore.js';
import { asOracleUserError } from '../oracle/errors.js';
import { cwd as getCwd } from 'node:process';

const isTty = process.stdout.isTTY;
const dim = (text: string): string => (isTty ? kleur.dim(text) : text);

export interface SessionRunParams {
  sessionMeta: SessionMetadata;
  runOptions: RunOracleOptions;
  mode: SessionMode;
  browserConfig?: BrowserSessionConfig;
  cwd: string;
  log: (message?: string) => void;
  write: (chunk: string) => boolean;
  version: string;
  notifications?: NotificationSettings;
  browserDeps?: BrowserSessionRunnerDeps;
  muteStdout?: boolean;
}

export async function performSessionRun({
  sessionMeta,
  runOptions,
  mode,
  browserConfig,
  cwd,
  log,
  write,
  version,
  notifications,
  browserDeps,
  muteStdout = false,
}: SessionRunParams): Promise<void> {
  await sessionStore.updateSession(sessionMeta.id, {
    status: 'running',
    startedAt: new Date().toISOString(),
    mode,
    ...(browserConfig ? { browser: { config: browserConfig } } : {}),
  });
  const notificationSettings = notifications ?? deriveNotificationSettingsFromMetadata(sessionMeta, process.env);
  const modelForStatus = runOptions.model ?? sessionMeta.model;

  try {
    if (mode !== 'browser') {
      throw new Error('API engine is no longer supported. Use the browser engine instead.');
    }
    if (!browserConfig) {
      throw new Error('Missing browser configuration for session.');
    }
    if (modelForStatus) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: 'running',
        startedAt: new Date().toISOString(),
      });
    }
    const runnerDeps = {
      ...browserDeps,
      persistRuntimeHint: async (runtime: BrowserRuntimeMetadata) => {
        await sessionStore.updateSession(sessionMeta.id, {
          status: 'running',
          browser: { config: browserConfig, runtime },
        });
      },
    };
    const result = await runBrowserSessionExecution({ runOptions, browserConfig, cwd, log }, runnerDeps);
    if (modelForStatus) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        usage: result.usage,
      });
    }
    await sessionStore.updateSession(sessionMeta.id, {
      status: 'completed',
      completedAt: new Date().toISOString(),
      usage: result.usage,
      elapsedMs: result.elapsedMs,
      browser: {
        config: browserConfig,
        runtime: result.runtime,
      },
      response: undefined,
      transport: undefined,
      error: undefined,
    });
    await writeAssistantOutput(runOptions.writeOutputPath, result.answerText ?? '', log);
    await sendSessionNotification(
      {
        sessionId: sessionMeta.id,
        sessionName: sessionMeta.options?.slug ?? sessionMeta.id,
        mode,
        model: sessionMeta.model,
        usage: result.usage,
        characters: result.answerText?.length,
      },
      notificationSettings,
      log,
      result.answerText?.slice(0, 140),
    );
    return;
  } catch (error: unknown) {
    const message = formatError(error);
    log(`ERROR: ${message}`);
    markErrorLogged(error);
    const userError = asOracleUserError(error);
    const connectionLost =
      userError?.category === 'browser-automation' && (userError.details as { stage?: string } | undefined)?.stage === 'connection-lost';
    if (connectionLost && mode === 'browser') {
      const runtime = (userError.details as { runtime?: BrowserRuntimeMetadata } | undefined)?.runtime;
      log(dim('Chrome disconnected before completion; keeping session running for reattach.'));
      if (modelForStatus) {
        await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
          status: 'running',
          completedAt: undefined,
        });
      }
      await sessionStore.updateSession(sessionMeta.id, {
        status: 'running',
        errorMessage: message,
        mode,
        browser: {
          config: browserConfig,
          runtime: runtime ?? sessionMeta.browser?.runtime,
        },
        response: { status: 'running', incompleteReason: 'chrome-disconnected' },
      });
      return;
    }
    if (userError) {
      log(dim(`User error (${userError.category}): ${userError.message}`));
    }
    await sessionStore.updateSession(sessionMeta.id, {
      status: 'error',
      completedAt: new Date().toISOString(),
      errorMessage: message,
      mode,
      browser: browserConfig ? { config: browserConfig } : undefined,
      response: undefined,
      transport: undefined,
      error: userError
        ? {
            category: userError.category,
            message: userError.message,
            details: userError.details,
          }
        : undefined,
    });
    if (modelForStatus) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: 'error',
        completedAt: new Date().toISOString(),
      });
    }
    throw error;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeAssistantOutput(targetPath: string | undefined, content: string, log: (message: string) => void) {
  if (!targetPath) return;
  if (!content || content.trim().length === 0) {
    log(dim('write-output skipped: no assistant content to save.'));
    return;
  }
  const normalizedTarget = path.resolve(targetPath);
  const normalizedSessionsDir = path.resolve(sessionStore.sessionsDir());
  if (
    normalizedTarget === normalizedSessionsDir ||
    normalizedTarget.startsWith(`${normalizedSessionsDir}${path.sep}`)
  ) {
    log(dim(`write-output skipped: refusing to write inside session storage (${normalizedSessionsDir}).`));
    return;
  }
  try {
    await fs.mkdir(path.dirname(normalizedTarget), { recursive: true });
    const payload = content.endsWith('\n') ? content : `${content}\n`;
    await fs.writeFile(normalizedTarget, payload, 'utf8');
    log(dim(`Saved assistant output to ${normalizedTarget}`));
    return normalizedTarget;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (isPermissionError(error)) {
      const fallbackPath = buildFallbackPath(normalizedTarget);
      if (fallbackPath) {
        try {
          await fs.mkdir(path.dirname(fallbackPath), { recursive: true });
          const payload = content.endsWith('\n') ? content : `${content}\n`;
          await fs.writeFile(fallbackPath, payload, 'utf8');
          log(dim(`write-output fallback to ${fallbackPath} (original failed: ${reason})`));
          return fallbackPath;
        } catch (innerError) {
          const innerReason = innerError instanceof Error ? innerError.message : String(innerError);
          log(dim(`write-output failed (${reason}); fallback failed (${innerReason}); session completed anyway.`));
          return;
        }
      }
    }
    log(dim(`write-output failed (${reason}); session completed anyway.`));
  }
}

function isPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  return code === 'EACCES' || code === 'EPERM';
}

function buildFallbackPath(original: string): string | null {
  const ext = path.extname(original);
  const stem = path.basename(original, ext);
  const dir = getCwd();
  const candidate = ext ? `${stem}.fallback${ext}` : `${stem}.fallback`;
  const fallback = path.join(dir, candidate);
  const normalizedSessionsDir = path.resolve(sessionStore.sessionsDir());
  const normalizedFallback = path.resolve(fallback);
  if (
    normalizedFallback === normalizedSessionsDir ||
    normalizedFallback.startsWith(`${normalizedSessionsDir}${path.sep}`)
  ) {
    return null;
  }
  return fallback;
}
