/**
 * Shared TypeScript shapes for the Google Apps Script Web App API.
 * The phone (Milestone 3 sync) and gas/Code.gs must stay in sync with these fields.
 *
 * Analogy: a bilingual phrasebook — both sides agree on the words before they talk.
 */

/** How the upload should treat rows that already exist in the Sheet. */
export type GasDuplicateMode = 'skip' | 'override';

/** One photo inside an upload/download item (ordered; one may be primary). */
export type GasItemImagePayload = {
  /** Local item_images.id when known. */
  imageId: number | null;
  /** 1-based display order (matches filename NN). */
  imageNumber: number;
  sortOrder: number;
  isPrimary: boolean;
  /** Raw Base64 (no data: prefix). Null when reusing an existing Drive URL. */
  imageBase64: string | null;
  imageMimeType: 'image/jpeg';
  /** Existing Drive URL when the photo was uploaded before. */
  driveImageUrl: string | null;
};

/** Compact metadata stored in the Sheet for import rebuild (no Base64). */
export type GasItemImageMetadata = {
  imageId: number | null;
  imageNumber: number;
  sortOrder: number;
  isPrimary: boolean;
  driveImageUrl: string | null;
};

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
  model: string;
  categoryName: string;
  purchasePriceUsd: number;
  /** YYYY-MM-DD when known; null when blank. */
  purchaseDate: string | null;
  description: string;
  /**
   * Primary photo Base64 for older gateways / compatibility.
   * Prefer `images` when present.
   */
  imageBase64: string | null;
  imageMimeType: 'image/jpeg';
  /** Every local photo in order (primary first is not required; use isPrimary). */
  images: GasItemImagePayload[];
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

export type GasUploadResultImage = {
  imageId: number | null;
  driveImageUrl: string | null;
  imageNumber: number;
  isPrimary: boolean;
};

export type GasUploadResultItem = {
  clientItemId: number;
  sheetRowId: string;
  /** Primary Drive URL (compat with older clients). */
  driveImageUrl: string | null;
  images?: GasUploadResultImage[];
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
  model: string;
  categoryName: string;
  purchasePriceUsd: number;
  /** YYYY-MM-DD when known; null when blank. */
  purchaseDate: string | null;
  description: string;
  /** Primary Drive URL for compatibility. */
  driveImageUrl: string | null;
  /** Ordered photo metadata for rebuilding item_images (may be empty). */
  images: GasItemImageMetadata[];
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
