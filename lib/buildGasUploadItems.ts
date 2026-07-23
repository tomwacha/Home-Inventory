// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';

import type { GasItemImagePayload, GasUploadItem } from '@/types/gasSync';
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
 * Turns sync rows into GAS upload items.
 * Only packs Base64 for photos that are not already on Drive (keeps payloads small).
 * Analogy: packing each inventory card into an envelope — skip re-mailing photos Google already has.
 */
export async function buildGasUploadItems(
  houseName: string,
  syncRows: SyncInventoryRow[],
): Promise<GasUploadItem[]> {
  const uploadItems: GasUploadItem[] = [];

  for (const syncRow of syncRows) {
    const images: GasItemImagePayload[] = [];

    for (let imageIndex = 0; imageIndex < syncRow.images.length; imageIndex += 1) {
      const itemImage = syncRow.images[imageIndex];
      // Already on Drive? Send the URL only — no need to re-upload the file bytes.
      const alreadyOnDrive =
        itemImage.driveImageUrl !== null && itemImage.driveImageUrl.length > 0;
      const imageBase64 = alreadyOnDrive
        ? null
        : await readLocalImageAsBase64(itemImage.localPath);

      images.push({
        imageId: itemImage.id,
        imageNumber: imageIndex + 1,
        sortOrder: itemImage.sortOrder,
        isPrimary: itemImage.isPrimary,
        imageBase64,
        imageMimeType: 'image/jpeg',
        driveImageUrl: itemImage.driveImageUrl,
      });
    }

    // Compat: singular Base64 is the primary photo (or first when flags are missing).
    const primaryImage =
      images.find((image) => image.isPrimary) ?? images[0] ?? null;

    uploadItems.push({
      clientItemId: syncRow.itemId,
      sheetRowId: syncRow.sheetRowId,
      houseName,
      roomName: syncRow.roomName,
      name: syncRow.itemName,
      brand: syncRow.brand,
      model: syncRow.model,
      categoryName: syncRow.categoryName,
      purchasePriceUsd: syncRow.purchasePriceUsd,
      purchaseDate: syncRow.purchaseDate,
      description: syncRow.description,
      imageBase64: primaryImage?.imageBase64 ?? null,
      imageMimeType: 'image/jpeg',
      images,
      updatedAt: syncRow.updatedAt,
    });
  }

  return uploadItems;
}
