import { buildSafeHouseFolderName } from '@/lib/houseFolders';

/**
 * Unit tests for pure folder-name logic (no device file system needed).
 * Analogy: checking that a label-maker prints safe stickers before we stick them on boxes.
 */
describe('buildSafeHouseFolderName', () => {
  // Confirms spaces become dashes so folder paths stay OS-friendly.
  test('replaces spaces with dashes', () => {
    const folderName = buildSafeHouseFolderName('Beach House');

    expect(folderName).toBe('Beach-House');
  });

  // Confirms punctuation and symbols are stripped; leftover spaces collapse to one dash.
  test('removes characters that are unsafe in folder names', () => {
    const folderName = buildSafeHouseFolderName('Mom & Dad\'s Place!');

    expect(folderName).toBe('Mom-Dads-Place');
  });

  // Confirms leading/trailing spaces do not become empty or messy names.
  test('trims whitespace before sanitizing', () => {
    const folderName = buildSafeHouseFolderName('  Cabin  ');

    expect(folderName).toBe('Cabin');
  });

  // Confirms empty / symbol-only input still gets a usable fallback name.
  test('returns a timestamped fallback when nothing usable remains', () => {
    const folderName = buildSafeHouseFolderName('!!!');

    expect(folderName.startsWith('house-')).toBe(true);
    expect(folderName.length).toBeGreaterThan('house-'.length);
  });

  // Confirms letters, numbers, dashes, and underscores are kept.
  test('keeps letters, numbers, dashes, and underscores', () => {
    const folderName = buildSafeHouseFolderName('House_2-Main');

    expect(folderName).toBe('House_2-Main');
  });
});
