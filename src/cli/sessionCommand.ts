import type { Command, OptionValues } from 'commander';
import { usesDefaultStatusFilters } from './options.js';
import { attachSession, showStatus, type ShowStatusOptions } from './sessionDisplay.js';

export interface StatusOptions extends OptionValues {
  hours: number;
  limit: number;
  all: boolean;
}

interface SessionCommandDependencies {
  showStatus: (options: ShowStatusOptions) => Promise<void> | void;
  attachSession: (sessionId: string) => Promise<void>;
  usesDefaultStatusFilters: (cmd: Command) => boolean;
}

const defaultDependencies: SessionCommandDependencies = {
  showStatus,
  attachSession,
  usesDefaultStatusFilters,
};

export async function handleSessionCommand(
  sessionId: string | undefined,
  command: Command,
  deps: SessionCommandDependencies = defaultDependencies,
): Promise<void> {
  const sessionOptions = command.opts<StatusOptions>();
  if (!sessionId) {
    const showExamples = deps.usesDefaultStatusFilters(command);
    await deps.showStatus({
      hours: sessionOptions.all ? Infinity : sessionOptions.hours,
      includeAll: sessionOptions.all,
      limit: sessionOptions.limit,
      showExamples,
    });
    return;
  }
  await deps.attachSession(sessionId);
}
