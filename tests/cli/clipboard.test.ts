import { describe, expect, test, vi } from 'vitest';
import { copyToClipboard } from '../../src/cli/clipboard.ts';

describe('copyToClipboard', () => {
  test('uses platform-preferred command first', async () => {
    const runCommand = vi.fn().mockResolvedValue({ code: 0 });
    const result = await copyToClipboard('hello', { platform: 'darwin', runCommand });
    expect(result).toEqual({ success: true, command: 'pbcopy' });
    expect(runCommand).toHaveBeenCalledTimes(1);
    expect(runCommand).toHaveBeenCalledWith('pbcopy', [], 'hello');
  });

  test('falls back through candidates until success', async () => {
    const runCommand = vi
      .fn()
      .mockRejectedValueOnce(new Error('missing'))
      .mockResolvedValueOnce({ code: 1 })
      .mockResolvedValueOnce({ code: 0 });
    const result = await copyToClipboard('hi', { platform: 'linux', runCommand });
    expect(result.success).toBe(true);
    expect(runCommand).toHaveBeenCalledTimes(3);
    expect(runCommand.mock.calls[2][0]).toBe('xsel');
  });

  test('returns failure when no command succeeds', async () => {
    const runCommand = vi.fn().mockResolvedValue({ code: 1 });
    const result = await copyToClipboard('nope', { platform: 'win32', runCommand });
    expect(result).toEqual({ success: false });
    expect(runCommand).toHaveBeenCalledTimes(2);
  });
});
