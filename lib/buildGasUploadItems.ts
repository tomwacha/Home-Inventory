// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';

import type { GasUploadItem } from '@/types/gasSync';
import type { SyncInventoryRow } from '@/types/inventory';

/**
 * Reads a local JPEG as raw Base64 (no data: prefix) for GAS upload.
 * Returns null when missing or unreadable.
 */
async function readLocalImageAsBase64(
  localImagePath: string | null,
): Promise<string | null> {
  if (localImagePath === null || localImagePath.length === 0) {
    return null;
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(localImagePath);

    if (!fileInfo.exists) {
      return null;
    }

    return FileSystem.readAsStringAsync(localImagePath, {
      encoding: FileSystem.EncodingType.Base64,
    });
  } catch (error) {
    console.log('readLocalImageAsBase64 skipped:', error);
    return null;
  }
}

/**
 * Turns sync rows into GAS upload items (images already Base64).
 * Analogy: packing each inventory card into an envelope the cloud receptionist understands.
 */
export async function buildGasUploadItems(
  houseName: string,
  syncRows: SyncInventoryRow[],
): Promise<GasUploadItem[]> {
  const uploadItems: GasUploadItem[] = [];

  for (const syncRow of syncRows) {
    const imageBase64 = await readLocalImageAsBase64(syncRow.localImagePath);

    uploadItems.push({
      clientItemId: syncRow.itemId,
      sheetRowId: syncRow.sheetRowId,
      houseName,
      roomName: syncRow.roomName,
      name: syncRow.itemName,
      brand: syncRow.brand,
      categoryName: syncRow.categoryName,
      purchasePriceUsd: syncRow.purchasePriceUsd,
      purchaseYear: syncRow.purchaseYear,
      description: syncRow.description,
      imageBase64,
      imageMimeType: 'image/jpeg',
      updatedAt: syncRow.updatedAt,
    });
  }

  return uploadItems;
}
