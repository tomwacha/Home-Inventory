import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { migrateDatabaseIfNeeded } from '@/db/migrations';

/** Single SQLite file name stored in the app's document directory. */
export const DATABASE_NAME = 'home-inventory.db';

let databasePromise: Promise<SQLiteDatabase> | null = null;

/**
 * Opens the database once, runs migrations, and reuses the same connection.
 * Call this from query helpers when you are outside React (or before Provider exists).
 */
export async function getDatabase(): Promise<SQLiteDatabase> {
  if (databasePromise === null) {
    databasePromise = (async () => {
      const database = await openDatabaseAsync(DATABASE_NAME);
      await migrateDatabaseIfNeeded(database);
      return database;
    })();
  }

  return databasePromise;
}

/**
 * Used by SQLiteProvider's onInit so React screens share the same migrated DB.
 */
export async function initializeDatabase(database: SQLiteDatabase): Promise<void> {
  await migrateDatabaseIfNeeded(database);
}
