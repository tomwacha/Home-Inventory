// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildInventoryCsv } from '@/lib/exportCsv';
import { buildInventoryPdfHtml, type ExportPdfItemBlock } from '@/lib/exportPdf';
import { buildSafeHouseFolderName } from '@/lib/houseFolders';
import type { ExportInventoryRow } from '@/types/inventory';

export type InventoryExportFormat = 'pdf' | 'csv';

/**
 * Reads a local image file as a JPEG data URI for embedding in PDF HTML.
 * Returns null when the file is missing or unreadable.
 */
async function readLocalImageAsDataUri(localImagePath: string | null): Promise<string | null> {
  if (localImagePath === null || localImagePath.length === 0) {
    return null;
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(localImagePath);

    if (!fileInfo.exists) {
      return null;
    }

    const base64Data = await FileSystem.readAsStringAsync(localImagePath, {
      encoding: FileSystem.EncodingType.Base64,
    });

    return `data:image/jpeg;base64,${base64Data}`;
  } catch (error) {
    console.log('readLocalImageAsDataUri skipped:', error);
    return null;
  }
}

/**
 * Builds PDF item blocks with optional embedded photos (Option A).
 */
export async function buildPdfItemsWithImages(
  rows: ExportInventoryRow[],
): Promise<ExportPdfItemBlock[]> {
  const pdfItems: ExportPdfItemBlock[] = [];

  for (const row of rows) {
    const imageDataUri = await readLocalImageAsDataUri(row.localImagePath);

    pdfItems.push({
      ...row,
      imageDataUri,
    });
  }

  return pdfItems;
}

/**
 * Creates a CSV or PDF file for a house and opens the system share sheet.
 */
export async function createAndShareInventoryExport(options: {
  format: InventoryExportFormat;
  houseName: string;
  rows: ExportInventoryRow[];
}): Promise<void> {
  const { format, houseName, rows } = options;

  const sharingIsAvailable = await Sharing.isAvailableAsync();

  if (!sharingIsAvailable) {
    throw new Error('Sharing is not available on this device.');
  }

  const cacheDirectory = FileSystem.cacheDirectory;

  if (cacheDirectory === null) {
    throw new Error('Cache directory is not available on this device.');
  }

  const safeHouseName = buildSafeHouseFolderName(houseName);
  const timestampMs = Date.now();

  if (format === 'csv') {
    const csvText = buildInventoryCsv(rows);
    const csvFileUri = `${cacheDirectory}home-inventory-${safeHouseName}-${timestampMs}.csv`;

    await FileSystem.writeAsStringAsync(csvFileUri, csvText, {
      encoding: FileSystem.EncodingType.UTF8,
    });

    await Sharing.shareAsync(csvFileUri, {
      mimeType: 'text/csv',
      dialogTitle: `Share ${houseName} inventory CSV`,
      UTI: 'public.comma-separated-values-text',
    });

    return;
  }

  // PDF path: embed photos into HTML, then let expo-print write a file.
  const pdfItems = await buildPdfItemsWithImages(rows);
  const generatedAtLabel = new Date().toLocaleString();
  const htmlDocument = buildInventoryPdfHtml({
    houseName,
    generatedAtLabel,
    items: pdfItems,
  });

  const printResult = await Print.printToFileAsync({
    html: htmlDocument,
  });

  await Sharing.shareAsync(printResult.uri, {
    mimeType: 'application/pdf',
    dialogTitle: `Share ${houseName} inventory PDF`,
    UTI: 'com.adobe.pdf',
  });
}
