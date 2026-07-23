import {
  GAS_UPLOAD_BATCH_SIZE,
  chunkGasUploadItems,
  toDuplicateCheckItems,
} from '@/lib/gasUploadPayload';
import type { GasUploadItem } from '@/types/gasSync';

/** Minimal upload item for payload helper tests. */
function makeUploadItem(
  clientItemId: number,
  overrides: Partial<GasUploadItem> = {},
): GasUploadItem {
  return {
    clientItemId,
    sheetRowId: `row-${clientItemId}`,
    houseName: 'Beach House',
    roomName: 'Kitchen',
    name: `Item ${clientItemId}`,
    brand: 'Acme',
    model: 'X',
    categoryName: 'Appliances',
    purchasePriceUsd: 10,
    purchaseDate: '2020-01-01',
    description: 'desc',
    imageBase64: 'YmFzZTY0',
    imageMimeType: 'image/jpeg',
    images: [
      {
        imageId: clientItemId,
        imageNumber: 1,
        sortOrder: 0,
        isPrimary: true,
        imageBase64: 'YmFzZTY0',
        imageMimeType: 'image/jpeg',
        driveImageUrl: null,
      },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('toDuplicateCheckItems', () => {
  test('clears Base64 and images but keeps identity fields', () => {
    const sourceItems = [makeUploadItem(1), makeUploadItem(2)];

    const slimItems = toDuplicateCheckItems(sourceItems);

    expect(slimItems).toHaveLength(2);
    expect(slimItems[0]).toMatchObject({
      clientItemId: 1,
      sheetRowId: 'row-1',
      houseName: 'Beach House',
      roomName: 'Kitchen',
      name: 'Item 1',
      imageBase64: null,
      images: [],
    });
    // Original upload items must stay untouched (photos still needed for upload).
    expect(sourceItems[0].imageBase64).toBe('YmFzZTY0');
    expect(sourceItems[0].images).toHaveLength(1);
  });
});

describe('chunkGasUploadItems', () => {
  test('uses default batch size of 5', () => {
    expect(GAS_UPLOAD_BATCH_SIZE).toBe(5);
  });

  test('splits items into batches of the given size', () => {
    const uploadItems = [1, 2, 3, 4, 5, 6, 7].map((id) => makeUploadItem(id));

    const batches = chunkGasUploadItems(uploadItems, 3);

    expect(batches).toHaveLength(3);
    expect(batches[0].map((item) => item.clientItemId)).toEqual([1, 2, 3]);
    expect(batches[1].map((item) => item.clientItemId)).toEqual([4, 5, 6]);
    expect(batches[2].map((item) => item.clientItemId)).toEqual([7]);
  });

  test('returns an empty list when there are no items', () => {
    expect(chunkGasUploadItems([])).toEqual([]);
  });

  test('throws when batchSize is not positive', () => {
    expect(() => chunkGasUploadItems([makeUploadItem(1)], 0)).toThrow(
      /batchSize must be greater than 0/i,
    );
  });
});
