import type { SQLiteDatabase } from 'expo-sqlite';

import type { House, NewHouseInput } from '@/types/inventory';

/** Raw row shape returned by SQLite (snake_case column names). */
type HouseRow = {
  id: number;
  name: string;
  folder_path: string;
  created_at: string;
};

/**
 * Converts a database row into the camelCase House type used by the UI.
 */
function mapHouseRowToHouse(row: HouseRow): House {
  return {
    id: row.id,
    name: row.name,
    folderPath: row.folder_path,
    createdAt: row.created_at,
  };
}

/**
 * Inserts a new house and returns the created record.
 */
export async function createHouse(
  database: SQLiteDatabase,
  input: NewHouseInput,
): Promise<House> {
  const createdAt = new Date().toISOString();

  const result = await database.runAsync(
    `INSERT INTO houses (name, folder_path, created_at)
     VALUES (?, ?, ?)`,
    input.name.trim(),
    input.folderPath,
    createdAt,
  );

  const createdHouse = await getHouseById(database, result.lastInsertRowId);

  if (createdHouse === null) {
    throw new Error('Failed to load house after insert.');
  }

  return createdHouse;
}

/**
 * Returns every house, sorted A–Z by name (Welcome list + header dropdown).
 */
export async function getAllHouses(database: SQLiteDatabase): Promise<House[]> {
  const rows = await database.getAllAsync<HouseRow>(
    `SELECT id, name, folder_path, created_at
     FROM houses
     ORDER BY name COLLATE NOCASE ASC`,
  );

  return rows.map(mapHouseRowToHouse);
}

/**
 * Loads one house by id, or null if it does not exist.
 */
export async function getHouseById(
  database: SQLiteDatabase,
  houseId: number,
): Promise<House | null> {
  const row = await database.getFirstAsync<HouseRow>(
    `SELECT id, name, folder_path, created_at
     FROM houses
     WHERE id = ?`,
    houseId,
  );

  if (row === null || row === undefined) {
    return null;
  }

  return mapHouseRowToHouse(row);
}

/**
 * Renames a house (folder path stays the same until a later file-system todo).
 */
export async function updateHouseName(
  database: SQLiteDatabase,
  houseId: number,
  name: string,
): Promise<void> {
  await database.runAsync(
    `UPDATE houses SET name = ? WHERE id = ?`,
    name.trim(),
    houseId,
  );
}

/**
 * Deletes a house. CASCADE removes its rooms and items in SQLite.
 */
export async function deleteHouse(
  database: SQLiteDatabase,
  houseId: number,
): Promise<void> {
  await database.runAsync(`DELETE FROM houses WHERE id = ?`, houseId);
}
