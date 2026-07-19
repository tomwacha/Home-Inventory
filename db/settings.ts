import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppSettings } from '@/types/inventory';

type AppSettingsRow = {
  id: number;
  gas_web_app_url: string | null;
  default_drive_folder_id: string | null;
};

/**
 * Converts a database row into the camelCase AppSettings type.
 */
function mapSettingsRowToAppSettings(row: AppSettingsRow): AppSettings {
  return {
    id: row.id,
    gasWebAppUrl: row.gas_web_app_url,
    defaultDriveFolderId: row.default_drive_folder_id,
  };
}

/**
 * Returns the single settings row (always id = 1).
 */
export async function getAppSettings(database: SQLiteDatabase): Promise<AppSettings> {
  const row = await database.getFirstAsync<AppSettingsRow>(
    `SELECT id, gas_web_app_url, default_drive_folder_id
     FROM app_settings
     WHERE id = 1`,
  );

  if (row === null || row === undefined) {
    // Migration should have inserted this row; recreate if somehow missing.
    await database.runAsync(
      `INSERT OR IGNORE INTO app_settings (id, gas_web_app_url, default_drive_folder_id)
       VALUES (1, NULL, NULL)`,
    );

    return {
      id: 1,
      gasWebAppUrl: null,
      defaultDriveFolderId: null,
    };
  }

  return mapSettingsRowToAppSettings(row);
}

/**
 * Saves cloud sync preferences for Milestone 3.
 */
export async function updateAppSettings(
  database: SQLiteDatabase,
  updates: {
    gasWebAppUrl: string | null;
    defaultDriveFolderId: string | null;
  },
): Promise<void> {
  await database.runAsync(
    `UPDATE app_settings
     SET gas_web_app_url = ?, default_drive_folder_id = ?
     WHERE id = 1`,
    updates.gasWebAppUrl,
    updates.defaultDriveFolderId,
  );
}
