import { parseDefaultImageSource } from '@/db/settings';

describe('parseDefaultImageSource', () => {
  test('accepts gallery', () => {
    expect(parseDefaultImageSource('gallery')).toBe('gallery');
  });

  test('defaults unknown or empty values to camera', () => {
    expect(parseDefaultImageSource('camera')).toBe('camera');
    expect(parseDefaultImageSource(null)).toBe('camera');
    expect(parseDefaultImageSource(undefined)).toBe('camera');
    expect(parseDefaultImageSource('weird')).toBe('camera');
  });
});
