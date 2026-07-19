import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Bump this number whenever you add a new migration block below.
 * SQLite stores the applied version in PRAGMA user_version.
 */
export const DATABASE_VERSION = 1;

/**
 * Creates tables (and later: alters them) so older installs can upgrade safely.
 * Analogy: a recipe version number — only cook the new steps you haven't done yet.
 */
export async function migrateDatabaseIfNeeded(database: SQLiteDatabase): Promise<void> {
  // Foreign keys are off by default in SQLite; turn them on for every open.
  await database.execAsync('PRAGMA foreign_keys = ON;');

  const versionRow = await database.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  let currentDatabaseVersion = versionRow?.user_version ?? 0;

  // Already up to date — nothing to do.
  if (currentDatabaseVersion >= DATABASE_VERSION) {
    return;
  }

  // Version 0 → 1: first-time schema for houses, rooms, categories, items, settings.
  if (currentDatabaseVersion === 0) {
    await database.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE IF NOT EXISTS houses (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL,
        folder_path TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS rooms (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        house_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        FOREIGN KEY (house_id) REFERENCES houses (id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        name TEXT NOT NULL UNIQUE
      );

      CREATE TABLE IF NOT EXISTS items (
        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        room_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        brand TEXT,
        category_id INTEGER,
        purchase_price_usd REAL NOT NULL DEFAULT 0,
        purchase_year INTEGER,
        description TEXT,
        local_image_path TEXT,
        drive_image_url TEXT,
        sheet_row_id TEXT,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'local',
        FOREIGN KEY (room_id) REFERENCES rooms (id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS app_settings (
        id INTEGER PRIMARY KEY NOT NULL CHECK (id = 1),
        gas_web_app_url TEXT,
        default_drive_folder_id TEXT
      );

      INSERT OR IGNORE INTO app_settings (id, gas_web_app_url, default_drive_folder_id)
      VALUES (1, NULL, NULL);
    `);

    currentDatabaseVersion = 1;
  }

  // Future migrations go here, for example:
  // if (currentDatabaseVersion === 1) { ...; currentDatabaseVersion = 2; }

  await database.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
