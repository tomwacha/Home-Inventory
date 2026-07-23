import { copyItem } from '@/lib/copyItem';
import type { Item, ItemImage } from '@/types/inventory';

jest.mock('expo-file-system/legacy', () => ({
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
}));

jest.mock('@/db/items', () => ({
  getItemById: jest.fn(),
  createItem: jest.fn(),
}));

jest.mock('@/db/itemImages', () => ({
  getImagesByItemId: jest.fn(),
  createItemImage: jest.fn(),
  updateItemImagePaths: jest.fn(),
  syncItemPrimaryImageColumns: jest.fn(),
}));

jest.mock('@/lib/itemImageFiles', () => ({
  buildStagedItemImageFileName: jest.fn(() => 'staged-copy.jpg'),
  buildFinalItemImageFileName: jest.fn(
    () => 'Beach House - Blender (Copy) - 01 - 99.jpg',
  ),
  renameLocalItemImageFile: jest.fn(
    async ({ houseFolderPath, finalFileName }) =>
      `${houseFolderPath}${finalFileName}`,
  ),
}));

import {
  createItemImage,
  getImagesByItemId,
  syncItemPrimaryImageColumns,
  updateItemImagePaths,
} from '@/db/itemImages';
import { createItem, getItemById } from '@/db/items';
import * as FileSystem from 'expo-file-system/legacy';

const fakeDatabase = {} as never;

const sourceItem: Item = {
  id: 7,
  roomId: 3,
  name: 'Blender',
  brand: 'Acme',
  model: 'X100',
  categoryId: 2,
  purchasePriceUsd: 49.5,
  purchaseDate: '2020-01-01',
  description: 'Red',
  localImagePath: 'file:///houses/Beach/old.jpg',
  driveImageUrl: 'https://drive.google.com/uc?id=old',
  sheetRowId: 'sheet-abc',
  updatedAt: '2026-01-01T00:00:00.000Z',
  syncStatus: 'synced',
};

const createdItem: Item = {
  ...sourceItem,
  id: 42,
  name: 'Blender (Copy)',
  localImagePath: null,
  driveImageUrl: null,
  sheetRowId: null,
  syncStatus: 'local',
};

const sourceImages: ItemImage[] = [
  {
    id: 11,
    itemId: 7,
    localPath: 'file:///houses/Beach/old.jpg',
    sortOrder: 0,
    isPrimary: true,
    driveImageUrl: 'https://drive.google.com/uc?id=old',
  },
];

describe('copyItem', () => {
  beforeEach(() => {
    jest.mocked(getItemById).mockReset();
    jest.mocked(createItem).mockReset();
    jest.mocked(getImagesByItemId).mockReset();
    jest.mocked(createItemImage).mockReset();
    jest.mocked(updateItemImagePaths).mockReset();
    jest.mocked(syncItemPrimaryImageColumns).mockReset();
    jest.mocked(FileSystem.copyAsync).mockReset();
    jest.mocked(FileSystem.makeDirectoryAsync).mockReset();
  });

  test('creates a new local item with (Copy) name and copied photo rows', async () => {
    jest
      .mocked(getItemById)
      .mockResolvedValueOnce(sourceItem)
      .mockResolvedValueOnce({
        ...createdItem,
        localImagePath: 'file:///houses/Beach/Beach House - Blender (Copy) - 01 - 99.jpg',
      });
    jest.mocked(createItem).mockResolvedValue(createdItem);
    jest.mocked(getImagesByItemId).mockResolvedValue(sourceImages);
    jest.mocked(createItemImage).mockResolvedValue({
      id: 99,
      itemId: 42,
      localPath: 'file:///houses/Beach/staged-copy.jpg',
      sortOrder: 0,
      isPrimary: true,
      driveImageUrl: null,
    });

    const result = await copyItem(
      fakeDatabase,
      7,
      'file:///houses/Beach/',
      'Beach House',
    );

    expect(createItem).toHaveBeenCalledWith(
      fakeDatabase,
      expect.objectContaining({
        roomId: 3,
        name: 'Blender (Copy)',
        brand: 'Acme',
        model: 'X100',
        categoryId: 2,
        purchasePriceUsd: 49.5,
        purchaseDate: '2020-01-01',
        description: 'Red',
        localImagePath: null,
      }),
    );
    expect(FileSystem.copyAsync).toHaveBeenCalledWith({
      from: 'file:///houses/Beach/old.jpg',
      to: 'file:///houses/Beach/staged-copy.jpg',
    });
    expect(createItemImage).toHaveBeenCalledWith(
      fakeDatabase,
      expect.objectContaining({
        itemId: 42,
        driveImageUrl: null,
        isPrimary: true,
      }),
    );
    expect(updateItemImagePaths).toHaveBeenCalledWith(fakeDatabase, 99, {
      localPath: 'file:///houses/Beach/Beach House - Blender (Copy) - 01 - 99.jpg',
      driveImageUrl: null,
    });
    expect(syncItemPrimaryImageColumns).toHaveBeenCalledWith(fakeDatabase, 42);
    expect(result.id).toBe(42);
    expect(result.name).toBe('Blender (Copy)');
    expect(result.sheetRowId).toBeNull();
  });

  test('throws when the source item is missing', async () => {
    jest.mocked(getItemById).mockResolvedValue(null);

    await expect(
      copyItem(fakeDatabase, 999, 'file:///houses/Beach/', 'Beach House'),
    ).rejects.toThrow(/Item not found/i);
  });
});
