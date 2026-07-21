import { importDownloadItemsForHouse } from '@/lib/importFromGas';
import type { GasDownloadItem } from '@/types/gasSync';
import type { House } from '@/types/inventory';

jest.mock('expo-file-system/legacy', () => ({
  makeDirectoryAsync: jest.fn(async () => undefined),
  downloadAsync: jest.fn(),
  moveAsync: jest.fn(async () => undefined),
}));

jest.mock('@/db/rooms', () => ({
  getOrCreateRoomByName: jest.fn(),
}));

jest.mock('@/db/categories', () => ({
  getOrCreateCategoryByName: jest.fn(),
}));

jest.mock('@/db/items', () => ({
  getItemBySheetRowIdInHouse: jest.fn(),
  getItemByRoomIdAndName: jest.fn(),
  applyImportedItemFields: jest.fn(),
  createItemFromImport: jest.fn(),
}));

jest.mock('@/db/itemImages', () => ({
  createItemImage: jest.fn(),
  deleteAllImagesForItem: jest.fn(),
  getImagesByItemId: jest.fn(),
  syncItemPrimaryImageColumns: jest.fn(),
  updateItemImagePaths: jest.fn(),
}));

jest.mock('@/lib/images', () => ({
  deleteLocalImageIfExists: jest.fn(),
}));

jest.mock('@/lib/itemImageFiles', () => ({
  buildStagedItemImageFileName: jest.fn(() => 'staged-1.jpg'),
  buildFinalItemImageFileName: jest.fn(() => 'Beach House - Blender - 01 - 50.jpg'),
  renameLocalItemImageFile: jest.fn(async ({ currentLocalPath }) => currentLocalPath),
}));

import { getOrCreateCategoryByName } from '@/db/categories';
import {
  createItemImage,
  deleteAllImagesForItem,
  getImagesByItemId,
  syncItemPrimaryImageColumns,
} from '@/db/itemImages';
import {
  applyImportedItemFields,
  createItemFromImport,
  getItemByRoomIdAndName,
  getItemBySheetRowIdInHouse,
} from '@/db/items';
import { getOrCreateRoomByName } from '@/db/rooms';
import * as FileSystem from 'expo-file-system/legacy';

const fakeDatabase = {} as never;

const sampleHouse: House = {
  id: 1,
  name: 'Beach House',
  folderPath: 'file:///houses/Beach/',
  createdAt: '2026-01-01T00:00:00.000Z',
};

function buildDownloadItem(
  overrides: Partial<GasDownloadItem> = {},
): GasDownloadItem {
  return {
    sheetRowId: 'sheet-1',
    houseName: 'Beach House',
    roomName: 'Kitchen',
    name: 'Blender',
    brand: 'Acme',
    model: 'X100',
    categoryName: 'Appliances',
    purchasePriceUsd: 49.5,
    purchaseDate: '2020-01-01',
    description: 'Red',
    driveImageUrl: null,
    images: [],
    updatedAt: '2026-01-02T00:00:00.000Z',
    ...overrides,
  };
}

describe('importDownloadItemsForHouse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(getOrCreateRoomByName).mockResolvedValue({
      id: 10,
      houseId: 1,
      name: 'Kitchen',
    });
    jest.mocked(getOrCreateCategoryByName).mockResolvedValue({
      id: 20,
      name: 'Appliances',
    });
    jest.mocked(getItemBySheetRowIdInHouse).mockResolvedValue(null);
    jest.mocked(getItemByRoomIdAndName).mockResolvedValue(null);
    jest.mocked(getImagesByItemId).mockResolvedValue([]);
    jest.mocked(createItemImage).mockResolvedValue({
      id: 50,
      itemId: 99,
      localPath: 'file:///houses/Beach/staged-1.jpg',
      sortOrder: 0,
      isPrimary: true,
      driveImageUrl: 'https://drive.example/file',
    });
  });

  test('skips rows missing room or item name', async () => {
    const summary = await importDownloadItemsForHouse(fakeDatabase, sampleHouse, [
      buildDownloadItem({ roomName: '  ', name: 'Blender' }),
      buildDownloadItem({ roomName: 'Kitchen', name: '' }),
    ]);

    expect(summary).toEqual({
      createdCount: 0,
      updatedCount: 0,
      skippedCount: 2,
    });
    expect(getOrCreateRoomByName).not.toHaveBeenCalled();
  });

  test('creates a new local item when nothing matches', async () => {
    jest.mocked(createItemFromImport).mockResolvedValue({
      id: 99,
      roomId: 10,
      name: 'Blender',
      brand: 'Acme',
      model: 'X100',
      categoryId: 20,
      purchasePriceUsd: 49.5,
      purchaseDate: '2020-01-01',
      description: 'Red',
      localImagePath: null,
      driveImageUrl: null,
      sheetRowId: 'sheet-1',
      updatedAt: '2026-01-02T00:00:00.000Z',
      syncStatus: 'synced',
    });

    const summary = await importDownloadItemsForHouse(fakeDatabase, sampleHouse, [
      buildDownloadItem(),
    ]);

    expect(summary.createdCount).toBe(1);
    expect(summary.updatedCount).toBe(0);
    expect(createItemFromImport).toHaveBeenCalledTimes(1);
    expect(createItemFromImport).toHaveBeenCalledWith(
      fakeDatabase,
      expect.objectContaining({
        model: 'X100',
        purchaseDate: '2020-01-01',
      }),
    );
    expect(applyImportedItemFields).not.toHaveBeenCalled();
  });

  test('updates an existing item matched by sheetRowId', async () => {
    jest.mocked(getItemBySheetRowIdInHouse).mockResolvedValue({
      id: 5,
      roomId: 10,
      name: 'Old Blender',
      brand: null,
      model: null,
      categoryId: null,
      purchasePriceUsd: 10,
      purchaseDate: null,
      description: null,
      localImagePath: 'file:///old.jpg',
      driveImageUrl: null,
      sheetRowId: 'sheet-1',
      updatedAt: '2026-01-01T00:00:00.000Z',
      syncStatus: 'local',
    });

    const summary = await importDownloadItemsForHouse(fakeDatabase, sampleHouse, [
      buildDownloadItem({ name: 'Blender' }),
    ]);

    expect(summary.updatedCount).toBe(1);
    expect(summary.createdCount).toBe(0);
    expect(applyImportedItemFields).toHaveBeenCalledWith(
      fakeDatabase,
      5,
      expect.objectContaining({
        name: 'Blender',
        sheetRowId: 'sheet-1',
        localImagePath: 'file:///old.jpg',
      }),
    );
    expect(createItemFromImport).not.toHaveBeenCalled();
  });

  test('downloads every Drive image when images metadata is present', async () => {
    jest.mocked(FileSystem.downloadAsync).mockResolvedValue({
      uri: 'file:///houses/Beach/staged-1.jpg',
      status: 200,
      headers: {},
      mimeType: 'image/jpeg',
    });
    jest.mocked(createItemFromImport).mockResolvedValue({
      id: 99,
      roomId: 10,
      name: 'Blender',
      brand: 'Acme',
      model: 'X100',
      categoryId: 20,
      purchasePriceUsd: 49.5,
      purchaseDate: '2020-01-01',
      description: 'Red',
      localImagePath: null,
      driveImageUrl: 'https://drive.example/file',
      sheetRowId: 'sheet-1',
      updatedAt: '2026-01-02T00:00:00.000Z',
      syncStatus: 'synced',
    });

    await importDownloadItemsForHouse(fakeDatabase, sampleHouse, [
      buildDownloadItem({
        driveImageUrl: 'https://drive.example/file',
        images: [
          {
            imageId: 11,
            imageNumber: 1,
            sortOrder: 0,
            isPrimary: true,
            driveImageUrl: 'https://drive.example/file',
          },
          {
            imageId: 12,
            imageNumber: 2,
            sortOrder: 1,
            isPrimary: false,
            driveImageUrl: 'https://drive.example/file-2',
          },
        ],
      }),
    ]);

    expect(FileSystem.downloadAsync).toHaveBeenCalledTimes(2);
    expect(deleteAllImagesForItem).toHaveBeenCalledWith(fakeDatabase, 99);
    expect(createItemImage).toHaveBeenCalledTimes(2);
    expect(syncItemPrimaryImageColumns).toHaveBeenCalledWith(fakeDatabase, 99);
  });
});
