import type { SQLiteDatabase } from 'expo-sqlite';

import type {
  HouseTotals,
  Item,
  NewItemInput,
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
