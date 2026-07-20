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
  categoryName: 'Appliances',
  purchasePriceUsd: 49.5,
  purchaseYear: 2020,
  description: 'Red',
  localImagePath: 'file:///photo.jpg',
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
      imageBase64: 'YmFzZTY0ZGF0YQ==',
      imageMimeType: 'image/jpeg',
    });
  });

  test('sends null imageBase64 when there is no local photo path', async () => {
    const rowWithoutPhoto: SyncInventoryRow = {
      ...sampleSyncRow,
      localImagePath: null,
    };

    const uploadItems = await buildGasUploadItems('Beach House', [rowWithoutPhoto]);

    expect(uploadItems[0].imageBase64).toBeNull();
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
    expect(FileSystem.readAsStringAsync).not.toHaveBeenCalled();
  });
});
