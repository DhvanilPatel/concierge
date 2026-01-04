import { describe, expect, test } from 'vitest';
import { shouldDetachSession } from '../../src/cli/detach.js';

describe('shouldDetachSession', () => {
  test('disables detach when env disables it', () => {
    const result = shouldDetachSession({
      waitPreference: false,
      disableDetachEnv: true,
    });
    expect(result).toBe(false);
  });

  test('disables detach when waitPreference is true', () => {
    const result = shouldDetachSession({
      waitPreference: true,
      disableDetachEnv: false,
    });
    expect(result).toBe(false);
  });

  test('allows detach when waitPreference is false and env allows', () => {
    const result = shouldDetachSession({
      waitPreference: false,
      disableDetachEnv: false,
    });
    expect(result).toBe(true);
  });
});
