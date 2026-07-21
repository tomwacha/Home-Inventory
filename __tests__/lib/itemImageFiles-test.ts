import {
  buildFinalItemImageFileName,
  buildStagedItemImageFileName,
  sanitizePhotoFileNameSegment,
} from '@/lib/itemImageFiles';
import {
  appendDraftItemPhoto,
  removeDraftItemPhoto,
  setDraftItemPhotoPrimary,
  type DraftItemPhoto,
} from '@/lib/persistItemPhotos';

describe('sanitizePhotoFileNameSegment', () => {
  test('strips path-breaking characters', () => {
    expect(sanitizePhotoFileNameSegment('Beach/House: TV?')).toBe('BeachHouse TV');
  });
});

describe('buildStagedItemImageFileName', () => {
  test('builds a staged jpeg name from a timestamp', () => {
    const fileName = buildStagedItemImageFileName(1_700_000_000_000);

    expect(fileName.startsWith('staged-1700000000000-')).toBe(true);
    expect(fileName.endsWith('.jpg')).toBe(true);
  });
});

describe('buildFinalItemImageFileName', () => {
  test('builds the approved house-item-number-id filename', () => {
    expect(
      buildFinalItemImageFileName({
        houseName: 'Beach House',
        itemName: 'Living Room Television',
        imageNumberOneBased: 2,
        photoDatabaseId: 147,
      }),
    ).toBe('Beach House - Living Room Television - 02 - 147.jpg');
  });
});

describe('draft item photo helpers', () => {
  const firstDraft: DraftItemPhoto = {
    clientKey: 'a',
    imageId: 1,
    localPath: 'file:///a.jpg',
    driveImageUrl: null,
    isPrimary: true,
    needsFinalize: false,
  };

  test('appends a new photo and makes it primary when empty', () => {
    const nextDrafts = appendDraftItemPhoto([], 'file:///new.jpg');

    expect(nextDrafts).toHaveLength(1);
    expect(nextDrafts[0].isPrimary).toBe(true);
    expect(nextDrafts[0].needsFinalize).toBe(true);
  });

  test('can change primary and remove with promotion', () => {
    const withSecond = appendDraftItemPhoto([firstDraft], 'file:///b.jpg');
    const promoted = setDraftItemPhotoPrimary(withSecond, withSecond[1].clientKey);

    expect(promoted[0].isPrimary).toBe(false);
    expect(promoted[1].isPrimary).toBe(true);

    const afterRemove = removeDraftItemPhoto(promoted, promoted[1].clientKey);

    expect(afterRemove).toHaveLength(1);
    expect(afterRemove[0].isPrimary).toBe(true);
  });
});
