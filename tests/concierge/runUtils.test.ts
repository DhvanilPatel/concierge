import { describe, expect, it } from 'vitest';
import { formatTokenCount, formatTokenValue } from '../../src/concierge/runUtils.js';

describe('runUtils #formatTokenCount', () => {
  it('returns plain number strings under 1000', () => {
    expect(formatTokenCount(999)).toBe('999');
  });

  it('abbreviates thousands with k and rounds to two decimals', () => {
    expect(formatTokenCount(4252)).toBe('4.25k');
    expect(formatTokenCount(4000)).toBe('4k');
  });
});

describe('runUtils #formatTokenValue', () => {
  const usageWithActuals = {
    input_tokens: 10,
    output_tokens: 20,
    reasoning_tokens: 5,
    total_tokens: 35,
  };

  it('marks values as estimated when usage fields are missing', () => {
    const result = formatTokenValue(1234, {}, 0);
    expect(result.endsWith('*')).toBe(true);
  });

  it('returns clean numbers when values are present', () => {
    const result = formatTokenValue(10, usageWithActuals, 0);
    expect(result).toBe('10');
  });
});
