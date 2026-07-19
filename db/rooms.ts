import type { SQLiteDatabase } from 'expo-sqlite';

import type { NewRoomInput, Room } from '@/types/inventory';

type RoomRow = {
  id: number;
  house_id: number;
  name: string;
};

/**
 * Converts a database row into the camelCase Room type.
 */
function mapRoomRowToRoom(row: RoomRow): Room {
  return {
    id: row.id,
    houseId: row.house_id,
    name: row.name,
  };
}

/**
 * Creates a room inside a house.
 */
export async function createRoom(
  database: SQLiteDatabase,
  input: NewRoomInput,
): Promise<Room> {
  const result = await database.runAsync(
    `INSERT INTO rooms (house_id, name) VALUES (?, ?)`,
    input.houseId,
    input.name.trim(),
  );

  const createdRoom = await getRoomById(database, result.lastInsertRowId);

  if (createdRoom === null) {
    throw new Error('Failed to load room after insert.');
  }

  return createdRoom;
}

/**
 * Lists rooms for a house alphabetically (Feature 3).
 */
export async function getRoomsByHouseId(
  database: SQLiteDatabase,
  houseId: number,
): Promise<Room[]> {
  const rows = await database.getAllAsync<RoomRow>(
    `SELECT id, house_id, name
     FROM rooms
     WHERE house_id = ?
     ORDER BY name COLLATE NOCASE ASC`,
    houseId,
  );

  return rows.map(mapRoomRowToRoom);
}

/**
 * Loads one room by id, or null if missing.
 */
export async function getRoomById(
  database: SQLiteDatabase,
  roomId: number,
): Promise<Room | null> {
  const row = await database.getFirstAsync<RoomRow>(
    `SELECT id, house_id, name
     FROM rooms
     WHERE id = ?`,
    roomId,
  );

  if (row === null || row === undefined) {
    return null;
  }

  return mapRoomRowToRoom(row);
}

/**
 * Renames a room.
 */
export async function updateRoomName(
  database: SQLiteDatabase,
  roomId: number,
  name: string,
): Promise<void> {
  await database.runAsync(
    `UPDATE rooms SET name = ? WHERE id = ?`,
    name.trim(),
    roomId,
  );
}

/**
 * Deletes a room. CASCADE removes its items.
 */
export async function deleteRoom(
  database: SQLiteDatabase,
  roomId: number,
): Promise<void> {
  await database.runAsync(`DELETE FROM rooms WHERE id = ?`, roomId);
}
