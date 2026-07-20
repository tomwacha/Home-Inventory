// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getOrCreateCategoryByName } from '@/db/categories';
import {
  applyImportedItemFields,
  createItemFromImport,
  getItemByRoomIdAndName,
  getItemBySheetRowIdInHouse,
} from '@/db/items';
import { getOrCreateRoomByName } from '@/db/rooms';
import { buildItemImageFileName } from '@/lib/images';
import type { GasDownloadItem } from '@/types/gasSync';
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

    const destinationUri = `${houseFolderPath}${buildItemImageFileName()}`;
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

  const downloadedLocalImagePath = await downloadDriveImageToHouseFolder(
    downloadItem.driveImageUrl,
    house.folderPath,
  );

  // Keep an existing local photo if Drive download failed.
  const nextLocalImagePath =
    downloadedLocalImagePath ?? existingItem?.localImagePath ?? null;

  const brandValue =
    downloadItem.brand.trim().length > 0 ? downloadItem.brand.trim() : null;
  const descriptionValue =
    downloadItem.description.trim().length > 0
      ? downloadItem.description.trim()
      : null;
  const updatedAtValue =
    downloadItem.updatedAt.trim().length > 0
      ? downloadItem.updatedAt
      : new Date().toISOString();

  if (existingItem !== null) {
    await applyImportedItemFields(database, existingItem.id, {
      roomId: room.id,
      name: trimmedItemName,
      brand: brandValue,
      categoryId,
      purchasePriceUsd: downloadItem.purchasePriceUsd,
      purchaseYear: downloadItem.purchaseYear,
      description: descriptionValue,
      localImagePath: nextLocalImagePath,
      driveImageUrl: downloadItem.driveImageUrl,
      sheetRowId: downloadItem.sheetRowId,
      updatedAt: updatedAtValue,
    });

    return 'updated';
  }

  await createItemFromImport(database, {
    roomId: room.id,
    name: trimmedItemName,
    brand: brandValue,
    categoryId,
    purchasePriceUsd: downloadItem.purchasePriceUsd,
    purchaseYear: downloadItem.purchaseYear,
    description: descriptionValue,
    localImagePath: nextLocalImagePath,
    driveImageUrl: downloadItem.driveImageUrl,
    sheetRowId: downloadItem.sheetRowId,
    updatedAt: updatedAtValue,
  });

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
