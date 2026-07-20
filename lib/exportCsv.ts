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
    'Category',
    'Purchase Price (USD)',
    'Purchase Year',
    'Description',
    'Has Local Photo',
  ];

  const headerLine = headerColumns.map(escapeCsvField).join(',');

  const dataLines = rows.map((row) => {
    const columns = [
      row.roomName,
      row.itemName,
      row.brand,
      row.categoryName,
      row.purchasePriceUsd.toFixed(2),
      row.purchaseYear,
      row.description,
      row.localImagePath !== null ? 'yes' : 'no',
    ];

    return columns.map(escapeCsvField).join(',');
  });

  return [headerLine, ...dataLines].join('\n');
}
