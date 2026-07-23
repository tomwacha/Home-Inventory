import type { SQLiteDatabase } from 'expo-sqlite';

import { getAppSettings } from '@/db/settings';
import type {
  GasCheckDuplicatesRequest,
  GasCheckDuplicatesResponse,
  GasDownloadResponse,
  GasDuplicateMode,
  GasErrorResponse,
  GasPingResponse,
  GasUploadItem,
  GasUploadRequest,
  GasUploadResponse,
} from '@/types/gasSync';

/**
 * Resolved connection details for talking to the Apps Script Web App.
 * Analogy: the address of the cloud receptionist (URL) plus the photo cabinet id.
 */
export type GasConnectionConfig = {
  webAppUrl: string;
  driveFolderId: string | null;
};

/**
 * Picks the Web App URL: SQLite settings win, then EXPO_PUBLIC env.
 * Returns null when neither is set (caller should send the user to Settings).
 */
export function pickGasWebAppUrl(
  settingsUrl: string | null,
  envUrl: string | undefined,
): string | null {
  const trimmedSettingsUrl = settingsUrl?.trim() ?? '';

  if (trimmedSettingsUrl.length > 0) {
    return trimmedSettingsUrl;
  }

  const trimmedEnvUrl = envUrl?.trim() ?? '';

  if (trimmedEnvUrl.length > 0) {
    return trimmedEnvUrl;
  }

  return null;
}

/**
 * Picks the Drive folder id: SQLite settings win, then EXPO_PUBLIC env.
 */
export function pickDriveFolderId(
  settingsFolderId: string | null,
  envFolderId: string | undefined,
): string | null {
  const trimmedSettingsFolderId = settingsFolderId?.trim() ?? '';

  if (trimmedSettingsFolderId.length > 0) {
    return trimmedSettingsFolderId;
  }

  const trimmedEnvFolderId = envFolderId?.trim() ?? '';

  if (trimmedEnvFolderId.length > 0) {
    return trimmedEnvFolderId;
  }

  return null;
}

/**
 * Loads settings + env and returns a connection config, or throws a clear error.
 * Does not include the secret URL in the error message.
 */
export async function resolveGasConnection(
  database: SQLiteDatabase,
): Promise<GasConnectionConfig> {
  const appSettings = await getAppSettings(database);

  const webAppUrl = pickGasWebAppUrl(
    appSettings.gasWebAppUrl,
    process.env.EXPO_PUBLIC_GAS_WEB_APP_URL,
  );

  if (webAppUrl === null) {
    throw new Error(
      'Google Apps Script URL is not set. Open Settings, paste your Web App URL, and Save.',
    );
  }

  const driveFolderId = pickDriveFolderId(
    appSettings.defaultDriveFolderId,
    process.env.EXPO_PUBLIC_DEFAULT_DRIVE_FOLDER_ID,
  );

  return {
    webAppUrl,
    driveFolderId,
  };
}

/**
 * Reads env defaults for prefilling the Settings form (when SQLite is empty).
 */
export function getEnvGasDefaults(): {
  webAppUrl: string;
  driveFolderId: string;
} {
  return {
    webAppUrl: process.env.EXPO_PUBLIC_GAS_WEB_APP_URL?.trim() ?? '',
    driveFolderId: process.env.EXPO_PUBLIC_DEFAULT_DRIVE_FOLDER_ID?.trim() ?? '',
  };
}

/**
 * Parses a fetch Response as GAS JSON. Throws friendly errors (never logs the URL).
 */
async function parseGasJsonResponse<TResponse extends { ok: true }>(
  response: Response,
): Promise<TResponse> {
  const responseText = await response.text();

  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(responseText);
  } catch {
    const trimmedText = responseText.trim();
    const looksLikeHtml =
      trimmedText.startsWith('<') ||
      /<!DOCTYPE/i.test(trimmedText) ||
      /<html/i.test(trimmedText);
    const isEmpty = trimmedText.length === 0;
    // Huge non-JSON often means a truncated timeout / proxy error page.
    const isHuge = responseText.length > 5000;

    if (isEmpty || looksLikeHtml || isHuge) {
      throw new Error(
        'Google Apps Script returned a non-JSON response (often a timeout or upload that is too large). Try again on Wi‑Fi, or sync after fewer new photos.',
      );
    }

    throw new Error(
      'The Google Apps Script URL did not return JSON. Check Settings: use the /exec Web App URL, and redeploy if you changed the script.',
    );
  }

  if (typeof parsedBody !== 'object' || parsedBody === null) {
    throw new Error('Unexpected response from Google Apps Script.');
  }

  const bodyRecord = parsedBody as Partial<GasErrorResponse> & Partial<TResponse>;

  if (bodyRecord.ok === false) {
    const errorMessage =
      typeof bodyRecord.error === 'string' && bodyRecord.error.length > 0
        ? bodyRecord.error
        : 'Google Apps Script returned an error.';
    throw new Error(errorMessage);
  }

  if (bodyRecord.ok !== true) {
    throw new Error('Unexpected response from Google Apps Script.');
  }

  if (!response.ok) {
    throw new Error(
      `Google Apps Script HTTP ${response.status}. Check the Web App deployment access (Anyone) and URL.`,
    );
  }

  return parsedBody as TResponse;
}

/**
 * GET health check: confirms the Web App URL works.
 */
export async function pingGas(webAppUrl: string): Promise<GasPingResponse> {
  try {
    const response = await fetch(`${webAppUrl}?action=ping`, {
      method: 'GET',
      redirect: 'follow',
    });

    return parseGasJsonResponse<GasPingResponse>(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Could not reach Google Apps Script. Check your network and Settings URL.');
  }
}

/**
 * GET download: all rows, or filtered by house name when provided.
 */
export async function downloadInventory(
  webAppUrl: string,
  houseName?: string,
): Promise<GasDownloadResponse> {
  try {
    const queryParts = ['action=download'];

    // Encode house name so spaces/special characters stay valid in the URL.
    if (houseName !== undefined && houseName.trim().length > 0) {
      queryParts.push(`houseName=${encodeURIComponent(houseName.trim())}`);
    }

    const response = await fetch(`${webAppUrl}?${queryParts.join('&')}`, {
      method: 'GET',
      redirect: 'follow',
    });

    return parseGasJsonResponse<GasDownloadResponse>(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Download from Google Sheets failed. Check your network and Settings URL.');
  }
}

/**
 * POST checkDuplicates: find Sheet clashes without writing.
 */
export async function checkDuplicates(
  webAppUrl: string,
  items: GasUploadItem[],
): Promise<GasCheckDuplicatesResponse> {
  try {
    const requestBody: GasCheckDuplicatesRequest = {
      action: 'checkDuplicates',
      items,
    };

    const response = await fetch(webAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(requestBody),
    });

    return parseGasJsonResponse<GasCheckDuplicatesResponse>(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Duplicate check failed. Check your network and Settings URL.');
  }
}

/**
 * POST upload: write Sheet rows and Drive photos.
 */
export async function uploadInventory(
  webAppUrl: string,
  items: GasUploadItem[],
  duplicateMode: GasDuplicateMode,
  driveFolderId: string | null,
): Promise<GasUploadResponse> {
  try {
    const requestBody: GasUploadRequest = {
      action: 'upload',
      driveFolderId,
      duplicateMode,
      items,
    };

    const response = await fetch(webAppUrl, {
      method: 'POST',
      redirect: 'follow',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(requestBody),
    });

    return parseGasJsonResponse<GasUploadResponse>(response);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }

    throw new Error('Upload to Google Sheets failed. Check your network and Settings URL.');
  }
}
