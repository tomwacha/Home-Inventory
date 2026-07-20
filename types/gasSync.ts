/**
 * Shared TypeScript shapes for the Google Apps Script Web App API.
 * The phone (Milestone 3 sync) and gas/Code.gs must stay in sync with these fields.
 *
 * Analogy: a bilingual phrasebook — both sides agree on the words before they talk.
 */

/** How the upload should treat rows that already exist in the Sheet. */
export type GasDuplicateMode = 'skip' | 'override';

/** One inventory item in an upload payload (image already Base64 on the phone). */
export type GasUploadItem = {
  /** Local SQLite item id (helpful for mapping responses). */
  clientItemId: number;
  /** Stable id from a previous sync; null for brand-new cloud rows. */
  sheetRowId: string | null;
  houseName: string;
  roomName: string;
  name: string;
  brand: string;
  categoryName: string;
  purchasePriceUsd: number;
  purchaseYear: number | null;
  description: string;
  /** Raw Base64 (no data:image/... prefix). Null when there is no photo. */
  imageBase64: string | null;
  imageMimeType: 'image/jpeg';
  updatedAt: string;
};

/** POST body for uploading items to Sheets + Drive. */
export type GasUploadRequest = {
  action: 'upload';
  /** Google Drive folder id for photos (from app settings or Script Properties). */
  driveFolderId: string | null;
  duplicateMode: GasDuplicateMode;
  items: GasUploadItem[];
};

/** POST body for detecting duplicates without writing. */
export type GasCheckDuplicatesRequest = {
  action: 'checkDuplicates';
  items: GasUploadItem[];
};

/** A Sheet row that matches an incoming item (same house + room + name, or same sheetRowId). */
export type GasDuplicateMatch = {
  clientItemId: number;
  sheetRowId: string;
  houseName: string;
  roomName: string;
  name: string;
  sheetRowNumber: number;
};

export type GasCheckDuplicatesResponse = {
  ok: true;
  action: 'checkDuplicates';
  duplicates: GasDuplicateMatch[];
};

export type GasUploadResultItem = {
  clientItemId: number;
  sheetRowId: string;
  driveImageUrl: string | null;
  status: 'created' | 'updated' | 'skipped';
};

export type GasUploadResponse = {
  ok: true;
  action: 'upload';
  results: GasUploadResultItem[];
};

/** One row returned by download (GET action=download). */
export type GasDownloadItem = {
  sheetRowId: string;
  houseName: string;
  roomName: string;
  name: string;
  brand: string;
  categoryName: string;
  purchasePriceUsd: number;
  purchaseYear: number | null;
  description: string;
  driveImageUrl: string | null;
  updatedAt: string;
};

export type GasDownloadResponse = {
  ok: true;
  action: 'download';
  items: GasDownloadItem[];
};

export type GasPingResponse = {
  ok: true;
  action: 'ping';
  message: string;
};

export type GasErrorResponse = {
  ok: false;
  error: string;
};
