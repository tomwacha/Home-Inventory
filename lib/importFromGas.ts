// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getOrCreateCategoryByName } from '@/db/categories';
import {
  createItemImage,
  deleteAllImagesForItem,
  getImagesByItemId,
  syncItemPrimaryImageColumns,
  updateItemImagePaths,
} from '@/db/itemImages';
import {
  applyImportedItemFields,
  createItemFromImport,
  getItemByRoomIdAndName,
  getItemBySheetRowIdInHouse,
} from '@/db/items';
import { getOrCreateRoomByName } from '@/db/rooms';
import { deleteLocalImageIfExists } from '@/lib/images';
import {
  buildFinalItemImageFileName,
  buildStagedItemImageFileName,
  renameLocalItemImageFile,
} from '@/lib/itemImageFiles';
import type { GasDownloadItem, GasItemImageMetadata } from '@/types/gasSync';
import type { House } from '@/types/inventory';

export type ImportFromGasSummary = {
  createdCount: number;
  updatedCount: number;
  skippedCount: number;
};

/**
 * Downloads a Drive image into the house folder when a URL is present.
 * Returns the local URI, or null when there is no URL / download fails.
 */
async function downloadDriveImageToHouseFolder(
  driveImageUrl: string | null,
  houseFolderPath: string,
): Promise<string | null> {
  if (driveImageUrl === null || driveImageUrl.trim().length === 0) {
    return null;
  }

  try {
    await FileSystem.makeDirectoryAsync(houseFolderPath, { intermediates: true });

    const destinationUri = `${houseFolderPath}${buildStagedItemImageFileName()}`;
    const downloadResult = await FileSystem.downloadAsync(
      driveImageUrl.trim(),
      destinationUri,
    );

    if (downloadResult.status < 200 || downloadResult.status >= 300) {
      console.log('downloadDriveImageToHouseFolder bad status:', downloadResult.status);
      return null;
    }

    return downloadResult.uri;
  } catch (error) {
    console.log('downloadDriveImageToHouseFolder skipped:', error);
    return null;
  }
}

/**
 * Builds ordered image metadata from download payload, falling back to primary URL.
 */
function buildImportImageMetadataList(
  downloadItem: GasDownloadItem,
): GasItemImageMetadata[] {
  if (downloadItem.images.length > 0) {
    return [...downloadItem.images].sort((left, right) => left.sortOrder - right.sortOrder);
  }

  if (downloadItem.driveImageUrl === null || downloadItem.driveImageUrl.trim().length === 0) {
    return [];
  }

  return [
    {
      imageId: null,
      imageNumber: 1,
      sortOrder: 0,
      isPrimary: true,
      driveImageUrl: downloadItem.driveImageUrl,
    },
  ];
}

/**
 * Replaces local item_images with cloud photos (download + finalize filenames).
 */
async function replaceItemImagesFromCloud(options: {
  database: SQLiteDatabase;
  itemId: number;
  houseName: string;
  itemName: string;
  houseFolderPath: string;
  imageMetadataList: GasItemImageMetadata[];
}): Promise<{ primaryLocalPath: string | null; primaryDriveUrl: string | null }> {
  const {
    database,
    itemId,
    houseName,
    itemName,
    houseFolderPath,
    imageMetadataList,
  } = options;

  const existingImages = await getImagesByItemId(database, itemId);

  for (const existingImage of existingImages) {
    await deleteLocalImageIfExists(existingImage.localPath);
  }

  await deleteAllImagesForItem(database, itemId);

  let primaryLocalPath: string | null = null;
  let primaryDriveUrl: string | null = null;

  for (let imageIndex = 0; imageIndex < imageMetadataList.length; imageIndex += 1) {
    const imageMetadata = imageMetadataList[imageIndex];
    const downloadedLocalPath = await downloadDriveImageToHouseFolder(
      imageMetadata.driveImageUrl,
      houseFolderPath,
    );

    const isPrimary =
      imageMetadata.isPrimary ||
      (imageIndex === 0 && !imageMetadataList.some((entry) => entry.isPrimary));

    const createdImage = await createItemImage(database, {
      itemId,
      localPath: downloadedLocalPath,
      sortOrder: imageMetadata.sortOrder ?? imageIndex,
      isPrimary,
      driveImageUrl: imageMetadata.driveImageUrl,
    });

    if (downloadedLocalPath !== null) {
      const finalFileName = buildFinalItemImageFileName({
        houseName,
        itemName,
        imageNumberOneBased: imageIndex + 1,
        photoDatabaseId: createdImage.id,
      });
      const finalLocalPath = await renameLocalItemImageFile({
        currentLocalPath: downloadedLocalPath,
        houseFolderPath,
        finalFileName,
      });

      await updateItemImagePaths(database, createdImage.id, {
        localPath: finalLocalPath,
      });

      if (isPrimary) {
        primaryLocalPath = finalLocalPath;
      }
    } else if (isPrimary) {
      primaryLocalPath = null;
    }

    if (isPrimary) {
      primaryDriveUrl = imageMetadata.driveImageUrl;
    }
  }

  await syncItemPrimaryImageColumns(database, itemId);

  return { primaryLocalPath, primaryDriveUrl };
}

/**
 * Merges one Sheet row into local SQLite for a house (create or update).
 * Does not delete local-only items.
 */
async function importOneDownloadItem(
  database: SQLiteDatabase,
  house: House,
  downloadItem: GasDownloadItem,
): Promise<'created' | 'updated' | 'skipped'> {
  const trimmedRoomName = downloadItem.roomName.trim();
  const trimmedItemName = downloadItem.name.trim();

  // Sheet rows without a room or name cannot be placed safely — skip them.
  if (trimmedRoomName.length === 0 || trimmedItemName.length === 0) {
    return 'skipped';
  }

  const room = await getOrCreateRoomByName(database, house.id, trimmedRoomName);
  const category = await getOrCreateCategoryByName(database, downloadItem.categoryName);
  const categoryId = category?.id ?? null;

  let existingItem = await getItemBySheetRowIdInHouse(
    database,
    house.id,
    downloadItem.sheetRowId,
  );

  // Fall back to room + name when the phone has never stored this sheet_row_id.
  if (existingItem === null) {
    existingItem = await getItemByRoomIdAndName(database, room.id, trimmedItemName);
  }

  const brandValue =
    downloadItem.brand.trim().length > 0 ? downloadItem.brand.trim() : null;
  const modelValue =
    downloadItem.model.trim().length > 0 ? downloadItem.model.trim() : null;
  const descriptionValue =
    downloadItem.description.trim().length > 0
      ? downloadItem.description.trim()
      : null;
  const updatedAtValue =
    downloadItem.updatedAt.trim().length > 0
      ? downloadItem.updatedAt
      : new Date().toISOString();

  const imageMetadataList = buildImportImageMetadataList(downloadItem);

  if (existingItem !== null) {
    await applyImportedItemFields(database, existingItem.id, {
      roomId: room.id,
      name: trimmedItemName,
      brand: brandValue,
      model: modelValue,
      categoryId,
      purchasePriceUsd: downloadItem.purchasePriceUsd,
      purchaseDate: downloadItem.purchaseDate,
      description: descriptionValue,
      localImagePath: existingItem.localImagePath,
      driveImageUrl: downloadItem.driveImageUrl,
      sheetRowId: downloadItem.sheetRowId,
      updatedAt: updatedAtValue,
    });

    if (imageMetadataList.length > 0) {
      await replaceItemImagesFromCloud({
        database,
        itemId: existingItem.id,
        houseName: house.name,
        itemName: trimmedItemName,
        houseFolderPath: house.folderPath,
        imageMetadataList,
      });
    }

    return 'updated';
  }

  const createdItem = await createItemFromImport(database, {
    roomId: room.id,
    name: trimmedItemName,
    brand: brandValue,
    model: modelValue,
    categoryId,
    purchasePriceUsd: downloadItem.purchasePriceUsd,
    purchaseDate: downloadItem.purchaseDate,
    description: descriptionValue,
    localImagePath: null,
    driveImageUrl: downloadItem.driveImageUrl,
    sheetRowId: downloadItem.sheetRowId,
    updatedAt: updatedAtValue,
  });

  if (imageMetadataList.length > 0) {
    await replaceItemImagesFromCloud({
      database,
      itemId: createdItem.id,
      houseName: house.name,
      itemName: trimmedItemName,
      houseFolderPath: house.folderPath,
      imageMetadataList,
    });
  }

  return 'created';
}

/**
 * Imports all download rows for one house into local SQLite (merge-in).
 */
export async function importDownloadItemsForHouse(
  database: SQLiteDatabase,
  house: House,
  downloadItems: GasDownloadItem[],
): Promise<ImportFromGasSummary> {
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const downloadItem of downloadItems) {
    const importResult = await importOneDownloadItem(database, house, downloadItem);

    if (importResult === 'created') {
      createdCount += 1;
    } else if (importResult === 'updated') {
      updatedCount += 1;
    } else {
      skippedCount += 1;
    }
  }

  return {
    createdCount,
    updatedCount,
    skippedCount,
  };
}
