import type { SQLiteDatabase } from 'expo-sqlite';

// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';

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
import {
  buildFinalItemImageFileName,
  buildStagedItemImageFileName,
  renameLocalItemImageFile,
} from '@/lib/itemImageFiles';
import type { Item } from '@/types/inventory';

/**
 * Strips a trailing " (Copy)" / " (Copy N)" so repeated copies share one base name.
 */
export function getCopyItemBaseName(itemName: string): string {
  const copySuffixMatch = itemName.match(/^(.*) \(Copy(?: \d+)?\)$/);

  if (copySuffixMatch !== null) {
    return copySuffixMatch[1];
  }

  return itemName;
}

/**
 * Picks the next unused copy name in a room: "Name (Copy)", then "Name (Copy 2)", …
 */
export function buildUniqueCopyItemName(
  sourceItemName: string,
  existingItemNames: string[],
): string {
  const baseName = getCopyItemBaseName(sourceItemName);
  const existingNameSet = new Set(
    existingItemNames.map((existingName) => existingName.trim()),
  );

  const firstCopyName = `${baseName} (Copy)`;

  if (!existingNameSet.has(firstCopyName)) {
    return firstCopyName;
  }

  let copyNumber = 2;

  // Keep counting until we find a free label in this room.
  while (existingNameSet.has(`${baseName} (Copy ${copyNumber})`)) {
    copyNumber += 1;
  }

  return `${baseName} (Copy ${copyNumber})`;
}

/**
 * Removes a partially created copy (DB row + any local photo files we made).
 */
async function rollbackPartialCopyItem(
  database: SQLiteDatabase,
  createdItemId: number,
  stagedLocalPaths: string[],
): Promise<void> {
  try {
    const createdImages = await getImagesByItemId(database, createdItemId);

    for (const createdImage of createdImages) {
      await deleteLocalImageIfExists(createdImage.localPath);
    }

    // Also remove staged files that never got an item_images row.
    for (const stagedLocalPath of stagedLocalPaths) {
      await deleteLocalImageIfExists(stagedLocalPath);
    }

    // item_images rows cascade-delete with the item.
    await deleteItem(database, createdItemId);
  } catch (rollbackError) {
    console.log('rollbackPartialCopyItem failed:', rollbackError);
  }
}

/**
 * Stages a source photo locally: copy file if present, else download from Drive.
 * Returns the staged local path, or null when neither source is usable.
 */
async function stageSourceImageForCopy(options: {
  localPath: string | null;
  driveImageUrl: string | null;
  houseFolderPath: string;
}): Promise<string | null> {
  const { localPath, driveImageUrl, houseFolderPath } = options;
  const stagedFileName = buildStagedItemImageFileName();
  const stagedLocalPath = `${houseFolderPath}${stagedFileName}`;

  if (localPath !== null && localPath.length > 0) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(localPath);

      if (fileInfo.exists) {
        await FileSystem.copyAsync({
          from: localPath,
          to: stagedLocalPath,
        });
        return stagedLocalPath;
      }
    } catch (error) {
      console.log('stageSourceImageForCopy local copy skipped:', error);
    }
  }

  if (driveImageUrl !== null && driveImageUrl.trim().length > 0) {
    try {
      const downloadResult = await FileSystem.downloadAsync(
        driveImageUrl.trim(),
        stagedLocalPath,
      );

      if (downloadResult.status >= 200 && downloadResult.status < 300) {
        return downloadResult.uri;
      }

      console.log(
        'stageSourceImageForCopy Drive download bad status:',
        downloadResult.status,
      );
    } catch (error) {
      console.log('stageSourceImageForCopy Drive download skipped:', error);
    }
  }

  return null;
}

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

  const roomItems = await getItemsByRoomId(database, sourceItem.roomId);
  const copiedItemName = buildUniqueCopyItemName(
    sourceItem.name,
    roomItems.map((roomItem) => roomItem.name),
  );

  let createdItemId: number | null = null;
  const stagedLocalPaths: string[] = [];

  try {
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
    createdItemId = createdItem.id;

    const sourceImages = await getImagesByItemId(database, sourceItemId);

    await FileSystem.makeDirectoryAsync(houseFolderPath, { intermediates: true });

    // Copy/download each photo into a new path so the original and copy stay independent.
    let copiedImageNumber = 0;

    for (let imageIndex = 0; imageIndex < sourceImages.length; imageIndex += 1) {
      const sourceImage = sourceImages[imageIndex];
      const stagedLocalPath = await stageSourceImageForCopy({
        localPath: sourceImage.localPath,
        driveImageUrl: sourceImage.driveImageUrl,
        houseFolderPath,
      });

      if (stagedLocalPath === null) {
        continue;
      }

      stagedLocalPaths.push(stagedLocalPath);
      copiedImageNumber += 1;

      const createdImage = await createItemImage(database, {
        itemId: createdItem.id,
        localPath: stagedLocalPath,
        sortOrder: sourceImage.sortOrder,
        isPrimary: sourceImage.isPrimary,
        // Fresh local copy — must re-upload to Drive later; do not reuse source Drive URL.
        driveImageUrl: null,
      });

      const finalFileName = buildFinalItemImageFileName({
        houseName,
        itemName: copiedItemName,
        imageNumberOneBased: copiedImageNumber,
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
  } catch (error) {
    if (createdItemId !== null) {
      await rollbackPartialCopyItem(database, createdItemId, stagedLocalPaths);
    }

    throw error;
  }
}
