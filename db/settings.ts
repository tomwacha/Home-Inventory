import type { SQLiteDatabase } from 'expo-sqlite';

import type { AppSettings, DefaultImageSource } from '@/types/inventory';

type AppSettingsRow = {
  id: number;
  gas_web_app_url: string | null;
  default_drive_folder_id: string | null;
  default_image_source: string | null;
};

/**
 * Narrows a stored string to camera | gallery (safe fallback: camera).
 */
export function parseDefaultImageSource(value: string | null | undefined): DefaultImageSource {
  if (value === 'gallery') {
    return 'gallery';
  }

  return 'camera';
}

/**
 * Converts a database row into the camelCase AppSettings type.
 */
function mapSettingsRowToAppSettings(row: AppSettingsRow): AppSettings {
  return {
    id: row.id,
    gasWebAppUrl: row.gas_web_app_url,
    defaultDriveFolderId: row.default_drive_folder_id,
    defaultImageSource: parseDefaultImageSource(row.default_image_source),
  };
}

/**
 * Returns the single settings row (always id = 1).
 */
export async function getAppSettings(database: SQLiteDatabase): Promise<AppSettings> {
  const row = await database.getFirstAsync<AppSettingsRow>(
    `SELECT id, gas_web_app_url, default_drive_folder_id, default_image_source
     FROM app_settings
     WHERE id = 1`,
  );

  if (row === null || row === undefined) {
    // Migration should have inserted this row; recreate if somehow missing.
    await database.runAsync(
      `INSERT OR IGNORE INTO app_settings (
         id, gas_web_app_url, default_drive_folder_id, default_image_source
       ) VALUES (1, NULL, NULL, 'camera')`,
    );

    return {
      id: 1,
      gasWebAppUrl: null,
      defaultDriveFolderId: null,
      defaultImageSource: 'camera',
    };
  }

  return mapSettingsRowToAppSettings(row);
}

/**
 * Saves app preferences (cloud sync + default photo source).
 */
export async function updateAppSettings(
  database: SQLiteDatabase,
  updates: {
    gasWebAppUrl: string | null;
    defaultDriveFolderId: string | null;
    defaultImageSource: DefaultImageSource;
  },
): Promise<void> {
  await database.runAsync(
    `UPDATE app_settings
     SET gas_web_app_url = ?,
         default_drive_folder_id = ?,
         default_image_source = ?
     WHERE id = 1`,
    updates.gasWebAppUrl,
    updates.defaultDriveFolderId,
    updates.defaultImageSource,
  );
}
