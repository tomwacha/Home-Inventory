import type { SQLiteDatabase } from 'expo-sqlite';

import {
  parseDefaultImageSource,
  updateDefaultImageSource,
} from '@/db/settings';

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

  test('saves only the selected default photo source', async () => {
    const runAsync = jest.fn().mockResolvedValue(undefined);
    const database = { runAsync } as unknown as SQLiteDatabase;

    await updateDefaultImageSource(database, 'gallery');

    expect(runAsync).toHaveBeenCalledWith(
      expect.stringContaining('SET default_image_source = ?'),
      'gallery',
    );
  });
});
