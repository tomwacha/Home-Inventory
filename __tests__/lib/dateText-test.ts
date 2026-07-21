import {
  isValidOptionalYyyyMmDd,
  normalizeOptionalYyyyMmDd,
} from '@/lib/dateText';

describe('isValidOptionalYyyyMmDd', () => {
  test('allows blank values', () => {
    expect(isValidOptionalYyyyMmDd('')).toBe(true);
    expect(isValidOptionalYyyyMmDd('   ')).toBe(true);
  });

  test('accepts YYYY-MM-DD', () => {
    expect(isValidOptionalYyyyMmDd('2020-01-01')).toBe(true);
  });

  test('rejects year-only and other shapes', () => {
    expect(isValidOptionalYyyyMmDd('2020')).toBe(false);
    expect(isValidOptionalYyyyMmDd('01/01/2020')).toBe(false);
    expect(isValidOptionalYyyyMmDd('2020-1-1')).toBe(false);
  });
});

describe('normalizeOptionalYyyyMmDd', () => {
  test('turns blank into null and trims valid dates', () => {
    expect(normalizeOptionalYyyyMmDd('')).toBeNull();
    expect(normalizeOptionalYyyyMmDd(' 2020-01-01 ')).toBe('2020-01-01');
  });
});
