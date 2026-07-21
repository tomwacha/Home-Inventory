import type { ExportInventoryRow } from '@/types/inventory';

/**
 * Escapes one CSV field so commas, quotes, and newlines stay inside one cell.
 * Analogy: putting a sticky note in quotes when it contains commas.
 */
export function escapeCsvField(value: string): string {
  // If the value has special characters, wrap it in quotes and double any quotes inside.
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }

  return value;
}

/**
 * Builds a full CSV document (header + one row per inventory item).
 */
export function buildInventoryCsv(rows: ExportInventoryRow[]): string {
  const headerColumns = [
    'Room',
    'Item Name',
    'Brand',
    'Model',
    'Category',
    'Purchase Price (USD)',
    'Purchase Date',
    'Description',
    'Photo Count',
    'Primary Photo',
    'Additional Photo 1',
    'Additional Photo 2',
    'Additional Photo 3',
    'Additional Photo 4',
    'Has Local Photo',
  ];

  const headerLine = headerColumns.map(escapeCsvField).join(',');

  const dataLines = rows.map((row) => {
    const columns = [
      row.roomName,
      row.itemName,
      row.brand,
      row.model,
      row.categoryName,
      row.purchasePriceUsd.toFixed(2),
      row.purchaseDate,
      row.description,
      String(row.photoCount),
      row.driveImageUrls[0] ?? '',
      row.driveImageUrls[1] ?? '',
      row.driveImageUrls[2] ?? '',
      row.driveImageUrls[3] ?? '',
      row.driveImageUrls[4] ?? '',
      row.localImagePath !== null ? 'yes' : 'no',
    ];

    return columns.map(escapeCsvField).join(',');
  });

  return [headerLine, ...dataLines].join('\n');
}
