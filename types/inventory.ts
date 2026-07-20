/**
 * Shared TypeScript shapes for inventory data.
 * These match the SQLite tables, but use camelCase (friendlier in JavaScript).
 */

/** How far an item has traveled toward Google Sheets sync. */
export type SyncStatus = 'local' | 'synced' | 'conflict';

export type House = {
  id: number;
  name: string;
  /** On-device folder under the app documents directory for this house's images. */
  folderPath: string;
  createdAt: string;
};

export type Room = {
  id: number;
  houseId: number;
  name: string;
};

export type Category = {
  id: number;
  name: string;
};

export type Item = {
  id: number;
  roomId: number;
  name: string;
  brand: string | null;
  categoryId: number | null;
  purchasePriceUsd: number;
  purchaseYear: number | null;
  description: string | null;
  localImagePath: string | null;
  driveImageUrl: string | null;
  sheetRowId: string | null;
  updatedAt: string;
  syncStatus: SyncStatus;
};

/** Single-row app preferences (cloud sync URL, etc.). */
export type AppSettings = {
  id: number;
  gasWebAppUrl: string | null;
  defaultDriveFolderId: string | null;
};

/** Input shapes used when creating rows (id is assigned by SQLite). */
export type NewHouseInput = {
  name: string;
  folderPath: string;
};

export type NewRoomInput = {
  houseId: number;
  name: string;
};

export type NewCategoryInput = {
  name: string;
};

export type NewItemInput = {
  roomId: number;
  name: string;
  brand?: string | null;
  categoryId?: number | null;
  purchasePriceUsd?: number;
  purchaseYear?: number | null;
  description?: string | null;
  localImagePath?: string | null;
};

/** Totals shown on the House Main Page (Feature 3). */
export type HouseTotals = {
  itemCount: number;
  totalValueUsd: number;
};

/**
 * One flattened inventory row for CSV/PDF export (room + category names included).
 */
export type ExportInventoryRow = {
  roomName: string;
  itemName: string;
  brand: string;
  categoryName: string;
  purchasePriceUsd: number;
  purchaseYear: string;
  description: string;
  localImagePath: string | null;
};
