import type { SQLiteDatabase } from 'expo-sqlite';

import type { ItemImage, NewItemImageInput } from '@/types/inventory';

type ItemImageRow = {
  id: number;
  item_id: number;
  local_path: string | null;
  sort_order: number;
  is_primary: number;
  drive_image_url: string | null;
};

/**
 * Converts a database row into the camelCase ItemImage type.
 */
function mapItemImageRowToItemImage(row: ItemImageRow): ItemImage {
  return {
    id: row.id,
    itemId: row.item_id,
    localPath: row.local_path,
    sortOrder: row.sort_order,
    isPrimary: row.is_primary === 1,
    driveImageUrl: row.drive_image_url,
  };
}

/**
 * Copies the primary item_images row onto items.local_image_path / drive_image_url.
 * Analogy: the room list still reads a sticky note on the item; we keep that note updated.
 */
export async function syncItemPrimaryImageColumns(
  database: SQLiteDatabase,
  itemId: number,
): Promise<void> {
  const primaryImage = await database.getFirstAsync<ItemImageRow>(
    `SELECT id, item_id, local_path, sort_order, is_primary, drive_image_url
     FROM item_images
     WHERE item_id = ? AND is_primary = 1
     ORDER BY sort_order ASC
     LIMIT 1`,
    itemId,
  );

  await database.runAsync(
    `UPDATE items SET
      local_image_path = ?,
      drive_image_url = ?
     WHERE id = ?`,
    primaryImage?.local_path ?? null,
    primaryImage?.drive_image_url ?? null,
    itemId,
  );
}

/**
 * Inserts one photo row for an item.
 */
export async function createItemImage(
  database: SQLiteDatabase,
  input: NewItemImageInput,
): Promise<ItemImage> {
  const result = await database.runAsync(
    `INSERT INTO item_images (
      item_id, local_path, sort_order, is_primary, drive_image_url
    ) VALUES (?, ?, ?, ?, ?)`,
    input.itemId,
    input.localPath,
    input.sortOrder,
    input.isPrimary ? 1 : 0,
    input.driveImageUrl ?? null,
  );

  const createdImage = await getItemImageById(database, result.lastInsertRowId);

  if (createdImage === null) {
    throw new Error('Failed to load item image after insert.');
  }

  return createdImage;
}

/**
 * Loads one photo by id, or null if missing.
 */
export async function getItemImageById(
  database: SQLiteDatabase,
  imageId: number,
): Promise<ItemImage | null> {
  const row = await database.getFirstAsync<ItemImageRow>(
    `SELECT id, item_id, local_path, sort_order, is_primary, drive_image_url
     FROM item_images
     WHERE id = ?`,
    imageId,
  );

  if (row === null || row === undefined) {
    return null;
  }

  return mapItemImageRowToItemImage(row);
}

/**
 * Lists photos for an item in display order.
 */
export async function getImagesByItemId(
  database: SQLiteDatabase,
  itemId: number,
): Promise<ItemImage[]> {
  const rows = await database.getAllAsync<ItemImageRow>(
    `SELECT id, item_id, local_path, sort_order, is_primary, drive_image_url
     FROM item_images
     WHERE item_id = ?
     ORDER BY sort_order ASC, id ASC`,
    itemId,
  );

  return rows.map(mapItemImageRowToItemImage);
}

/**
 * Updates local path and/or Drive URL after rename or cloud upload.
 */
export async function updateItemImagePaths(
  database: SQLiteDatabase,
  imageId: number,
  updates: {
    localPath?: string | null;
    driveImageUrl?: string | null;
  },
): Promise<void> {
  const existingImage = await getItemImageById(database, imageId);

  if (existingImage === null) {
    return;
  }

  const nextLocalPath =
    updates.localPath !== undefined ? updates.localPath : existingImage.localPath;
  const nextDriveImageUrl =
    updates.driveImageUrl !== undefined
      ? updates.driveImageUrl
      : existingImage.driveImageUrl;

  await database.runAsync(
    `UPDATE item_images SET
      local_path = ?,
      drive_image_url = ?
     WHERE id = ?`,
    nextLocalPath,
    nextDriveImageUrl,
    imageId,
  );
}

/**
 * Updates sort order and primary flag for one photo row.
 */
export async function updateItemImageFlags(
  database: SQLiteDatabase,
  imageId: number,
  updates: {
    sortOrder: number;
    isPrimary: boolean;
  },
): Promise<void> {
  await database.runAsync(
    `UPDATE item_images SET
      sort_order = ?,
      is_primary = ?
     WHERE id = ?`,
    updates.sortOrder,
    updates.isPrimary ? 1 : 0,
    imageId,
  );
}

/**
 * Deletes one photo row (caller should delete the local file when needed).
 */
export async function deleteItemImage(
  database: SQLiteDatabase,
  imageId: number,
): Promise<void> {
  await database.runAsync(`DELETE FROM item_images WHERE id = ?`, imageId);
}

/**
 * Deletes every photo row for an item (files cleaned by the caller).
 */
export async function deleteAllImagesForItem(
  database: SQLiteDatabase,
  itemId: number,
): Promise<void> {
  await database.runAsync(`DELETE FROM item_images WHERE item_id = ?`, itemId);
}
