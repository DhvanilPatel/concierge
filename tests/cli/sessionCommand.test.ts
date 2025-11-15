import { describe, expect, test, vi } from 'vitest';
import { Command } from 'commander';
import { handleSessionCommand, type StatusOptions } from '../../src/cli/sessionCommand.ts';

function createCommandWithOptions(options: StatusOptions): Command {
  const command = new Command();
  command.setOptionValueWithSource('hours', options.hours, 'cli');
  command.setOptionValueWithSource('limit', options.limit, 'cli');
  command.setOptionValueWithSource('all', options.all, 'cli');
  return command;
}

describe('handleSessionCommand', () => {
  test('lists sessions when no id provided', async () => {
    const command = createCommandWithOptions({ hours: 12, limit: 5, all: false });
    const showStatus = vi.fn();
    await handleSessionCommand(undefined, command, {
      showStatus,
      attachSession: vi.fn(),
      usesDefaultStatusFilters: vi.fn().mockReturnValue(true),
    });
    expect(showStatus).toHaveBeenCalledWith({
      hours: 12,
      includeAll: false,
      limit: 5,
      showExamples: true,
    });
  });

  test('attaches when id provided', async () => {
    const command = createCommandWithOptions({ hours: 24, limit: 10, all: false });
    const attachSession = vi.fn();
    await handleSessionCommand('abc', command, {
      showStatus: vi.fn(),
      attachSession,
      usesDefaultStatusFilters: vi.fn(),
    });
    expect(attachSession).toHaveBeenCalledWith('abc');
  });

  test('forces infinite range when --all set', async () => {
    const command = createCommandWithOptions({ hours: 1, limit: 25, all: true });
    const showStatus = vi.fn();
    await handleSessionCommand(undefined, command, {
      showStatus,
      attachSession: vi.fn(),
      usesDefaultStatusFilters: vi.fn().mockReturnValue(false),
    });
    expect(showStatus).toHaveBeenCalledWith({
      hours: Infinity,
      includeAll: true,
      limit: 25,
      showExamples: false,
    });
  });
});
