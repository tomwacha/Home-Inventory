import type { SQLiteDatabase } from 'expo-sqlite';

import type { GasUploadResultItem } from '@/types/gasSync';
import type {
  ExportInventoryRow,
  HouseTotals,
  Item,
  NewItemInput,
  SyncInventoryRow,
  SyncStatus,
} from '@/types/inventory';

type ItemRow = {
  id: number;
  room_id: number;
  name: string;
  brand: string | null;
  category_id: number | null;
  purchase_price_usd: number;
  purchase_year: number | null;
  description: string | null;
  local_image_path: string | null;
  drive_image_url: string | null;
  sheet_row_id: string | null;
  updated_at: string;
  sync_status: string;
};

/**
 * Narrows a stored string to our SyncStatus union, with a safe fallback.
 */
function parseSyncStatus(value: string): SyncStatus {
  if (value === 'synced' || value === 'conflict' || value === 'local') {
    return value;
  }

  return 'local';
}

/**
 * Converts a database row into the camelCase Item type.
 */
function mapItemRowToItem(row: ItemRow): Item {
  return {
    id: row.id,
    roomId: row.room_id,
    name: row.name,
    brand: row.brand,
    categoryId: row.category_id,
    purchasePriceUsd: row.purchase_price_usd,
    purchaseYear: row.purchase_year,
    description: row.description,
    localImagePath: row.local_image_path,
    driveImageUrl: row.drive_image_url,
    sheetRowId: row.sheet_row_id,
    updatedAt: row.updated_at,
    syncStatus: parseSyncStatus(row.sync_status),
  };
}

/**
 * Creates an item in a room. Image sync fields stay empty until later milestones.
 */
export async function createItem(
  database: SQLiteDatabase,
  input: NewItemInput,
): Promise<Item> {
  const updatedAt = new Date().toISOString();

  const result = await database.runAsync(
    `INSERT INTO items (
      room_id,
      name,
      brand,
      category_id,
      purchase_price_usd,
      purchase_year,
      description,
      local_image_path,
      drive_image_url,
      sheet_row_id,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, 'local')`,
    input.roomId,
    input.name.trim(),
    input.brand ?? null,
    input.categoryId ?? null,
    input.purchasePriceUsd ?? 0,
    input.purchaseYear ?? null,
    input.description ?? null,
    input.localImagePath ?? null,
    updatedAt,
  );

  const createdItem = await getItemById(database, result.lastInsertRowId);

  if (createdItem === null) {
    throw new Error('Failed to load item after insert.');
  }

  return createdItem;
}

/**
 * Lists items in a room alphabetically by name (Feature 4).
 */
export async function getItemsByRoomId(
  database: SQLiteDatabase,
  roomId: number,
): Promise<Item[]> {
  const rows = await database.getAllAsync<ItemRow>(
    `SELECT
      id, room_id, name, brand, category_id,
      purchase_price_usd, purchase_year, description,
      local_image_path, drive_image_url, sheet_row_id,
      updated_at, sync_status
     FROM items
     WHERE room_id = ?
     ORDER BY name COLLATE NOCASE ASC`,
    roomId,
  );

  return rows.map(mapItemRowToItem);
}

/**
 * Loads one item by id, or null if missing.
 */
export async function getItemById(
  database: SQLiteDatabase,
  itemId: number,
): Promise<Item | null> {
  const row = await database.getFirstAsync<ItemRow>(
    `SELECT
      id, room_id, name, brand, category_id,
      purchase_price_usd, purchase_year, description,
      local_image_path, drive_image_url, sheet_row_id,
      updated_at, sync_status
     FROM items
     WHERE id = ?`,
    itemId,
  );

  if (row === null || row === undefined) {
    return null;
  }

  return mapItemRowToItem(row);
}

/**
 * Updates editable item fields and bumps updated_at / sync_status to local.
 */
export async function updateItem(
  database: SQLiteDatabase,
  itemId: number,
  updates: {
    name: string;
    brand: string | null;
    categoryId: number | null;
    purchasePriceUsd: number;
    purchaseYear: number | null;
    description: string | null;
    localImagePath: string | null;
  },
): Promise<void> {
  const updatedAt = new Date().toISOString();

  await database.runAsync(
    `UPDATE items SET
      name = ?,
      brand = ?,
      category_id = ?,
      purchase_price_usd = ?,
      purchase_year = ?,
      description = ?,
      local_image_path = ?,
      updated_at = ?,
      sync_status = 'local'
     WHERE id = ?`,
    updates.name.trim(),
    updates.brand,
    updates.categoryId,
    updates.purchasePriceUsd,
    updates.purchaseYear,
    updates.description,
    updates.localImagePath,
    updatedAt,
    itemId,
  );
}

/**
 * Deletes one item row.
 */
export async function deleteItem(
  database: SQLiteDatabase,
  itemId: number,
): Promise<void> {
  await database.runAsync(`DELETE FROM items WHERE id = ?`, itemId);
}

/**
 * Searches items in a house by name or description (Feature 3).
 */
export async function searchItemsInHouse(
  database: SQLiteDatabase,
  houseId: number,
  searchText: string,
): Promise<Item[]> {
  const trimmedSearchText = searchText.trim();

  // Empty search returns nothing; callers can fall back to the room list UI.
  if (trimmedSearchText.length === 0) {
    return [];
  }

  const likePattern = `%${trimmedSearchText}%`;

  const rows = await database.getAllAsync<ItemRow>(
    `SELECT
      items.id, items.room_id, items.name, items.brand, items.category_id,
      items.purchase_price_usd, items.purchase_year, items.description,
      items.local_image_path, items.drive_image_url, items.sheet_row_id,
      items.updated_at, items.sync_status
     FROM items
     INNER JOIN rooms ON rooms.id = items.room_id
     WHERE rooms.house_id = ?
       AND (items.name LIKE ? OR IFNULL(items.description, '') LIKE ?)
     ORDER BY items.name COLLATE NOCASE ASC`,
    houseId,
    likePattern,
    likePattern,
  );

  return rows.map(mapItemRowToItem);
}

/**
 * Searches items in one room by name or description.
 */
export async function searchItemsInRoom(
  database: SQLiteDatabase,
  roomId: number,
  searchText: string,
): Promise<Item[]> {
  const trimmedSearchText = searchText.trim();

  // Empty search returns nothing; callers fall back to the full room list.
  if (trimmedSearchText.length === 0) {
    return [];
  }

  const likePattern = `%${trimmedSearchText}%`;

  const rows = await database.getAllAsync<ItemRow>(
    `SELECT
      id, room_id, name, brand, category_id,
      purchase_price_usd, purchase_year, description,
      local_image_path, drive_image_url, sheet_row_id,
      updated_at, sync_status
     FROM items
     WHERE room_id = ?
       AND (name LIKE ? OR IFNULL(description, '') LIKE ?)
     ORDER BY name COLLATE NOCASE ASC`,
    roomId,
    likePattern,
    likePattern,
  );

  return rows.map(mapItemRowToItem);
}

/**
 * Computes item count and total purchase value for a house (Feature 3 header).
 */
export async function getHouseTotals(
  database: SQLiteDatabase,
  houseId: number,
): Promise<HouseTotals> {
  const row = await database.getFirstAsync<{
    item_count: number;
    total_value_usd: number | null;
  }>(
    `SELECT
      COUNT(items.id) AS item_count,
      SUM(items.purchase_price_usd) AS total_value_usd
     FROM items
     INNER JOIN rooms ON rooms.id = items.room_id
     WHERE rooms.house_id = ?`,
    houseId,
  );

  return {
    itemCount: row?.item_count ?? 0,
    totalValueUsd: row?.total_value_usd ?? 0,
  };
}

type ExportInventoryRowSql = {
  room_name: string;
  item_name: string;
  brand: string | null;
  category_name: string | null;
  purchase_price_usd: number;
  purchase_year: number | null;
  description: string | null;
  local_image_path: string | null;
};

/**
 * Loads every item in a house with room/category names for CSV and PDF export.
 * Sorted by room name, then item name.
 */
export async function getExportRowsForHouse(
  database: SQLiteDatabase,
  houseId: number,
): Promise<ExportInventoryRow[]> {
  const rows = await database.getAllAsync<ExportInventoryRowSql>(
    `SELECT
      rooms.name AS room_name,
      items.name AS item_name,
      items.brand AS brand,
      categories.name AS category_name,
      items.purchase_price_usd AS purchase_price_usd,
      items.purchase_year AS purchase_year,
      items.description AS description,
      items.local_image_path AS local_image_path
     FROM items
     INNER JOIN rooms ON rooms.id = items.room_id
     LEFT JOIN categories ON categories.id = items.category_id
     WHERE rooms.house_id = ?
     ORDER BY rooms.name COLLATE NOCASE ASC, items.name COLLATE NOCASE ASC`,
    houseId,
  );

  return rows.map((row) => ({
    roomName: row.room_name,
    itemName: row.item_name,
    brand: row.brand ?? '',
    categoryName: row.category_name ?? '',
    purchasePriceUsd: row.purchase_price_usd,
    purchaseYear: row.purchase_year !== null ? String(row.purchase_year) : '',
    description: row.description ?? '',
    localImagePath: row.local_image_path,
  }));
}

type SyncInventoryRowSql = {
  item_id: number;
  sheet_row_id: string | null;
  room_name: string;
  item_name: string;
  brand: string | null;
  category_name: string | null;
  purchase_price_usd: number;
  purchase_year: number | null;
  description: string | null;
  local_image_path: string | null;
  updated_at: string;
};

/**
 * Loads every item in a house with ids needed for Google Sheets upload.
 */
export async function getSyncRowsForHouse(
  database: SQLiteDatabase,
  houseId: number,
): Promise<SyncInventoryRow[]> {
  const rows = await database.getAllAsync<SyncInventoryRowSql>(
    `SELECT
      items.id AS item_id,
      items.sheet_row_id AS sheet_row_id,
      rooms.name AS room_name,
      items.name AS item_name,
      items.brand AS brand,
      categories.name AS category_name,
      items.purchase_price_usd AS purchase_price_usd,
      items.purchase_year AS purchase_year,
      items.description AS description,
      items.local_image_path AS local_image_path,
      items.updated_at AS updated_at
     FROM items
     INNER JOIN rooms ON rooms.id = items.room_id
     LEFT JOIN categories ON categories.id = items.category_id
     WHERE rooms.house_id = ?
     ORDER BY rooms.name COLLATE NOCASE ASC, items.name COLLATE NOCASE ASC`,
    houseId,
  );

  return rows.map((row) => ({
    itemId: row.item_id,
    sheetRowId: row.sheet_row_id,
    roomName: row.room_name,
    itemName: row.item_name,
    brand: row.brand ?? '',
    categoryName: row.category_name ?? '',
    purchasePriceUsd: row.purchase_price_usd,
    purchaseYear: row.purchase_year,
    description: row.description ?? '',
    localImagePath: row.local_image_path,
    updatedAt: row.updated_at,
  }));
}

/**
 * After a successful upload, stores sheet ids / Drive URLs and marks items synced.
 * Skipped results leave the local row unchanged (still awaiting a later override).
 */
export async function markItemsSyncedFromUploadResults(
  database: SQLiteDatabase,
  uploadResults: GasUploadResultItem[],
): Promise<void> {
  for (const uploadResult of uploadResults) {
    // Skipped duplicates were not written — keep local sync_status as-is.
    if (uploadResult.status === 'skipped') {
      continue;
    }

    await database.runAsync(
      `UPDATE items SET
        sheet_row_id = ?,
        drive_image_url = ?,
        sync_status = 'synced'
       WHERE id = ?`,
      uploadResult.sheetRowId,
      uploadResult.driveImageUrl,
      uploadResult.clientItemId,
    );
  }
}

/**
 * Finds an item in a house by its cloud sheet_row_id (for import matching).
 */
export async function getItemBySheetRowIdInHouse(
  database: SQLiteDatabase,
  houseId: number,
  sheetRowId: string,
): Promise<Item | null> {
  const row = await database.getFirstAsync<ItemRow>(
    `SELECT
      items.id, items.room_id, items.name, items.brand, items.category_id,
      items.purchase_price_usd, items.purchase_year, items.description,
      items.local_image_path, items.drive_image_url, items.sheet_row_id,
      items.updated_at, items.sync_status
     FROM items
     INNER JOIN rooms ON rooms.id = items.room_id
     WHERE rooms.house_id = ?
       AND items.sheet_row_id = ?
     LIMIT 1`,
    houseId,
    sheetRowId,
  );

  if (row === null || row === undefined) {
    return null;
  }

  return mapItemRowToItem(row);
}

/**
 * Finds an item by room id + name (case-insensitive) for import matching.
 */
export async function getItemByRoomIdAndName(
  database: SQLiteDatabase,
  roomId: number,
  itemName: string,
): Promise<Item | null> {
  const row = await database.getFirstAsync<ItemRow>(
    `SELECT
      id, room_id, name, brand, category_id,
      purchase_price_usd, purchase_year, description,
      local_image_path, drive_image_url, sheet_row_id,
      updated_at, sync_status
     FROM items
     WHERE room_id = ?
       AND name = ? COLLATE NOCASE
     LIMIT 1`,
    roomId,
    itemName.trim(),
  );

  if (row === null || row === undefined) {
    return null;
  }

  return mapItemRowToItem(row);
}

/**
 * Writes cloud fields onto an existing local item during import (merge, not wipe).
 */
export async function applyImportedItemFields(
  database: SQLiteDatabase,
  itemId: number,
  updates: {
    roomId: number;
    name: string;
    brand: string | null;
    categoryId: number | null;
    purchasePriceUsd: number;
    purchaseYear: number | null;
    description: string | null;
    localImagePath: string | null;
    driveImageUrl: string | null;
    sheetRowId: string;
    updatedAt: string;
  },
): Promise<void> {
  await database.runAsync(
    `UPDATE items SET
      room_id = ?,
      name = ?,
      brand = ?,
      category_id = ?,
      purchase_price_usd = ?,
      purchase_year = ?,
      description = ?,
      local_image_path = ?,
      drive_image_url = ?,
      sheet_row_id = ?,
      updated_at = ?,
      sync_status = 'synced'
     WHERE id = ?`,
    updates.roomId,
    updates.name.trim(),
    updates.brand,
    updates.categoryId,
    updates.purchasePriceUsd,
    updates.purchaseYear,
    updates.description,
    updates.localImagePath,
    updates.driveImageUrl,
    updates.sheetRowId,
    updates.updatedAt,
    itemId,
  );
}

/**
 * Inserts a new local item from a cloud download row.
 */
export async function createItemFromImport(
  database: SQLiteDatabase,
  input: {
    roomId: number;
    name: string;
    brand: string | null;
    categoryId: number | null;
    purchasePriceUsd: number;
    purchaseYear: number | null;
    description: string | null;
    localImagePath: string | null;
    driveImageUrl: string | null;
    sheetRowId: string;
    updatedAt: string;
  },
): Promise<Item> {
  const result = await database.runAsync(
    `INSERT INTO items (
      room_id,
      name,
      brand,
      category_id,
      purchase_price_usd,
      purchase_year,
      description,
      local_image_path,
      drive_image_url,
      sheet_row_id,
      updated_at,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
    input.roomId,
    input.name.trim(),
    input.brand,
    input.categoryId,
    input.purchasePriceUsd,
    input.purchaseYear,
    input.description,
    input.localImagePath,
    input.driveImageUrl,
    input.sheetRowId,
    input.updatedAt,
  );

  const createdItem = await getItemById(database, result.lastInsertRowId);

  if (createdItem === null) {
    throw new Error('Failed to load item after import insert.');
  }

  return createdItem;
}
