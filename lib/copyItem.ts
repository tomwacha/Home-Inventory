import type { SQLiteDatabase } from 'expo-sqlite';

// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';

import {
  createItemImage,
  getImagesByItemId,
  syncItemPrimaryImageColumns,
  updateItemImagePaths,
} from '@/db/itemImages';
import { createItem, getItemById } from '@/db/items';
import {
  buildFinalItemImageFileName,
  buildStagedItemImageFileName,
  renameLocalItemImageFile,
} from '@/lib/itemImageFiles';
import type { Item } from '@/types/inventory';

/**
 * Duplicates one item (same room) with a new local-only copy of its photos.
 * Analogy: photocopy a catalog card + its photo stickers into a fresh set of files.
 */
export async function copyItem(
  database: SQLiteDatabase,
  sourceItemId: number,
  houseFolderPath: string,
  houseName: string,
): Promise<Item> {
  const sourceItem = await getItemById(database, sourceItemId);

  if (sourceItem === null) {
    throw new Error('Item not found.');
  }

  const copiedItemName = `${sourceItem.name} (Copy)`;

  // createItem always clears sheet_row_id / drive_image_url and sets sync_status = local.
  const createdItem = await createItem(database, {
    roomId: sourceItem.roomId,
    name: copiedItemName,
    brand: sourceItem.brand,
    model: sourceItem.model,
    categoryId: sourceItem.categoryId,
    purchasePriceUsd: sourceItem.purchasePriceUsd,
    purchaseDate: sourceItem.purchaseDate,
    description: sourceItem.description,
    localImagePath: null,
  });

  const sourceImages = await getImagesByItemId(database, sourceItemId);

  await FileSystem.makeDirectoryAsync(houseFolderPath, { intermediates: true });

  // Copy each local photo file into a new path so editing one item does not touch the other.
  for (let imageIndex = 0; imageIndex < sourceImages.length; imageIndex += 1) {
    const sourceImage = sourceImages[imageIndex];

    if (sourceImage.localPath === null || sourceImage.localPath.length === 0) {
      continue;
    }

    const stagedFileName = buildStagedItemImageFileName();
    const stagedLocalPath = `${houseFolderPath}${stagedFileName}`;

    await FileSystem.copyAsync({
      from: sourceImage.localPath,
      to: stagedLocalPath,
    });

    const createdImage = await createItemImage(database, {
      itemId: createdItem.id,
      localPath: stagedLocalPath,
      sortOrder: sourceImage.sortOrder,
      isPrimary: sourceImage.isPrimary,
      // Fresh copy — must re-upload to Drive later; do not share the source Drive URL.
      driveImageUrl: null,
    });

    const finalFileName = buildFinalItemImageFileName({
      houseName,
      itemName: copiedItemName,
      imageNumberOneBased: imageIndex + 1,
      photoDatabaseId: createdImage.id,
    });
    const finalLocalPath = await renameLocalItemImageFile({
      currentLocalPath: stagedLocalPath,
      houseFolderPath,
      finalFileName,
    });

    await updateItemImagePaths(database, createdImage.id, {
      localPath: finalLocalPath,
      driveImageUrl: null,
    });
  }

  await syncItemPrimaryImageColumns(database, createdItem.id);

  const copiedItem = await getItemById(database, createdItem.id);

  if (copiedItem === null) {
    throw new Error('Failed to load item after copy.');
  }

  return copiedItem;
}
