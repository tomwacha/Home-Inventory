import { buildGasUploadItems } from '@/lib/buildGasUploadItems';
import type { SyncInventoryRow } from '@/types/inventory';

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: {
    Base64: 'base64',
  },
  getInfoAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';

const sampleSyncRow: SyncInventoryRow = {
  itemId: 7,
  sheetRowId: 'row-abc',
  roomName: 'Kitchen',
  itemName: 'Blender',
  brand: 'Acme',
  model: 'X100',
  categoryName: 'Appliances',
  purchasePriceUsd: 49.5,
  purchaseDate: '2020-01-01',
  description: 'Red',
  localImagePath: 'file:///photo.jpg',
  images: [
    {
      id: 11,
      itemId: 7,
      localPath: 'file:///photo.jpg',
      sortOrder: 0,
      isPrimary: true,
      driveImageUrl: null,
    },
    {
      id: 12,
      itemId: 7,
      localPath: 'file:///photo-2.jpg',
      sortOrder: 1,
      isPrimary: false,
      driveImageUrl: null,
    },
  ],
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('buildGasUploadItems', () => {
  beforeEach(() => {
    jest.mocked(FileSystem.getInfoAsync).mockReset();
    jest.mocked(FileSystem.readAsStringAsync).mockReset();
  });

  test('maps sync rows and embeds Base64 when the local photo exists', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true,
      uri: 'file:///photo.jpg',
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    jest.mocked(FileSystem.readAsStringAsync).mockResolvedValue('YmFzZTY0ZGF0YQ==');

    const uploadItems = await buildGasUploadItems('Beach House', [sampleSyncRow]);

    expect(uploadItems).toHaveLength(1);
    expect(uploadItems[0]).toMatchObject({
      clientItemId: 7,
      sheetRowId: 'row-abc',
      houseName: 'Beach House',
      roomName: 'Kitchen',
      name: 'Blender',
      brand: 'Acme',
      model: 'X100',
      purchaseDate: '2020-01-01',
      imageBase64: 'YmFzZTY0ZGF0YQ==',
      imageMimeType: 'image/jpeg',
    });
    expect(uploadItems[0].images).toHaveLength(2);
    expect(uploadItems[0].images[0]).toMatchObject({
      imageId: 11,
      imageNumber: 1,
      isPrimary: true,
      imageBase64: 'YmFzZTY0ZGF0YQ==',
    });
  });

  test('sends null imageBase64 when there is no local photo path', async () => {
    const rowWithoutPhoto: SyncInventoryRow = {
      ...sampleSyncRow,
      localImagePath: null,
      images: [],
    };

    const uploadItems = await buildGasUploadItems('Beach House', [rowWithoutPhoto]);

    expect(uploadItems[0].imageBase64).toBeNull();
    expect(uploadItems[0].images).toEqual([]);
    expect(FileSystem.getInfoAsync).not.toHaveBeenCalled();
  });

  test('sends null imageBase64 when the local file is missing', async () => {
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: false,
      uri: 'file:///missing.jpg',
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);

    const uploadItems = await buildGasUploadItems('Beach House', [sampleSyncRow]);

    expect(uploadItems[0].imageBase64).toBeNull();
    expect(uploadItems[0].images[0].imageBase64).toBeNull();
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });
});
