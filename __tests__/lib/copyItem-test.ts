import {
  buildUniqueCopyItemName,
  copyItem,
  getCopyItemBaseName,
} from '@/lib/copyItem';
import type { Item, ItemImage } from '@/types/inventory';

jest.mock('expo-file-system/legacy', () => ({
  makeDirectoryAsync: jest.fn(async () => undefined),
  copyAsync: jest.fn(async () => undefined),
  getInfoAsync: jest.fn(async () => ({
    exists: true,
    isDirectory: false,
    uri: 'file:///houses/Beach/old.jpg',
  })),
  downloadAsync: jest.fn(async (_url: string, destinationUri: string) => ({
    status: 200,
    uri: destinationUri,
  })),
}));

jest.mock('@/db/items', () => ({
  getItemById: jest.fn(),
  createItem: jest.fn(),
  getItemsByRoomId: jest.fn(),
  deleteItem: jest.fn(),
}));

jest.mock('@/db/itemImages', () => ({
  getImagesByItemId: jest.fn(),
  createItemImage: jest.fn(),
  updateItemImagePaths: jest.fn(),
  syncItemPrimaryImageColumns: jest.fn(),
}));

jest.mock('@/lib/images', () => ({
  deleteLocalImageIfExists: jest.fn(async () => undefined),
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
import {
  createItem,
  deleteItem,
  getItemById,
  getItemsByRoomId,
} from '@/db/items';
import { deleteLocalImageIfExists } from '@/lib/images';
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

describe('getCopyItemBaseName / buildUniqueCopyItemName', () => {
  test('strips an existing Copy suffix before numbering', () => {
    expect(getCopyItemBaseName('Blender (Copy)')).toBe('Blender');
    expect(getCopyItemBaseName('Blender (Copy 3)')).toBe('Blender');
    expect(getCopyItemBaseName('Blender')).toBe('Blender');
  });

  test('uses (Copy) then (Copy 2) when names are taken', () => {
    expect(buildUniqueCopyItemName('Blender', ['Blender'])).toBe('Blender (Copy)');
    expect(
      buildUniqueCopyItemName('Blender', ['Blender', 'Blender (Copy)']),
    ).toBe('Blender (Copy 2)');
    expect(
      buildUniqueCopyItemName('Blender (Copy)', [
        'Blender',
        'Blender (Copy)',
        'Blender (Copy 2)',
      ]),
    ).toBe('Blender (Copy 3)');
  });
});

describe('copyItem', () => {
  beforeEach(() => {
    jest.mocked(getItemById).mockReset();
    jest.mocked(createItem).mockReset();
    jest.mocked(getItemsByRoomId).mockReset();
    jest.mocked(deleteItem).mockReset();
    jest.mocked(getImagesByItemId).mockReset();
    jest.mocked(createItemImage).mockReset();
    jest.mocked(updateItemImagePaths).mockReset();
    jest.mocked(syncItemPrimaryImageColumns).mockReset();
    jest.mocked(FileSystem.copyAsync).mockReset();
    jest.mocked(FileSystem.makeDirectoryAsync).mockReset();
    jest.mocked(FileSystem.getInfoAsync).mockReset();
    jest.mocked(FileSystem.downloadAsync).mockReset();
    jest.mocked(deleteLocalImageIfExists).mockReset();
    jest.mocked(getItemsByRoomId).mockResolvedValue([sourceItem]);
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true,
      isDirectory: false,
      uri: 'file:///houses/Beach/old.jpg',
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    jest.mocked(FileSystem.downloadAsync).mockImplementation(async (_url, destinationUri) => ({
      status: 200,
      uri: destinationUri,
      headers: {},
      mimeType: 'image/jpeg',
    }));
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

  test('uses (Copy 2) when (Copy) already exists in the room', async () => {
    jest.mocked(getItemsByRoomId).mockResolvedValue([
      sourceItem,
      { ...createdItem, id: 41, name: 'Blender (Copy)' },
    ]);
    jest
      .mocked(getItemById)
      .mockResolvedValueOnce(sourceItem)
      .mockResolvedValueOnce({ ...createdItem, name: 'Blender (Copy 2)' });
    jest.mocked(createItem).mockResolvedValue({
      ...createdItem,
      name: 'Blender (Copy 2)',
    });
    jest.mocked(getImagesByItemId).mockResolvedValue([]);

    await copyItem(fakeDatabase, 7, 'file:///houses/Beach/', 'Beach House');

    expect(createItem).toHaveBeenCalledWith(
      fakeDatabase,
      expect.objectContaining({ name: 'Blender (Copy 2)' }),
    );
  });

  test('downloads Drive photos when localPath is missing', async () => {
    jest
      .mocked(getItemById)
      .mockResolvedValueOnce(sourceItem)
      .mockResolvedValueOnce(createdItem);
    jest.mocked(createItem).mockResolvedValue(createdItem);
    jest.mocked(getImagesByItemId).mockResolvedValue([
      {
        id: 11,
        itemId: 7,
        localPath: null,
        sortOrder: 0,
        isPrimary: true,
        driveImageUrl: 'https://drive.google.com/uc?id=abc',
      },
    ]);
    jest.mocked(createItemImage).mockResolvedValue({
      id: 99,
      itemId: 42,
      localPath: 'file:///houses/Beach/staged-copy.jpg',
      sortOrder: 0,
      isPrimary: true,
      driveImageUrl: null,
    });

    await copyItem(fakeDatabase, 7, 'file:///houses/Beach/', 'Beach House');

    expect(FileSystem.downloadAsync).toHaveBeenCalledWith(
      'https://drive.google.com/uc?id=abc',
      'file:///houses/Beach/staged-copy.jpg',
    );
    expect(FileSystem.copyAsync).not.toHaveBeenCalled();
    expect(createItemImage).toHaveBeenCalled();
  });

  test('rolls back the new item when photo persistence fails', async () => {
    jest.mocked(getItemById).mockResolvedValue(sourceItem);
    jest.mocked(createItem).mockResolvedValue(createdItem);
    // First call loads source photos; rollback loads the new item's photos then deletes.
    jest
      .mocked(getImagesByItemId)
      .mockResolvedValueOnce(sourceImages)
      .mockResolvedValueOnce([
        {
          id: 99,
          itemId: 42,
          localPath: 'file:///houses/Beach/staged-copy.jpg',
          sortOrder: 0,
          isPrimary: true,
          driveImageUrl: null,
        },
      ]);
    jest.mocked(createItemImage).mockRejectedValue(new Error('db full'));

    await expect(
      copyItem(fakeDatabase, 7, 'file:///houses/Beach/', 'Beach House'),
    ).rejects.toThrow(/db full/i);

    expect(deleteItem).toHaveBeenCalledWith(fakeDatabase, 42);
    expect(deleteLocalImageIfExists).toHaveBeenCalledWith(
      'file:///houses/Beach/staged-copy.jpg',
    );
  });

  test('throws when the source item is missing', async () => {
    jest.mocked(getItemById).mockResolvedValue(null);

    await expect(
      copyItem(fakeDatabase, 999, 'file:///houses/Beach/', 'Beach House'),
    ).rejects.toThrow(/Item not found/i);
  });
});
