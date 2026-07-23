// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildInventoryCsv } from '@/lib/exportCsv';
import {
  buildInventoryPdfChunkHtml,
  buildInventoryPdfHtml,
  chunkPlannedPdfPages,
  planHousePdfDocument,
  type ExportPdfItemBlock,
  type PlannedHousePdfPage,
  PDF_LANDSCAPE_LETTER_HEIGHT,
  PDF_LANDSCAPE_LETTER_WIDTH,
} from '@/lib/exportPdf';
import { buildSafeHouseFolderName } from '@/lib/houseFolders';
import { mergePdfFileUris } from '@/lib/mergePdfFiles';
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
 * Builds PDF item blocks without embedding photos (layout uses path/photoCount).
 */
export function buildPdfItemsForPlanning(
  rows: ExportInventoryRow[],
): ExportPdfItemBlock[] {
  return rows.map((row) => ({
    ...row,
    imageDataUris: [],
  }));
}

/**
 * Builds PDF item blocks with every local photo embedded (primary first).
 * Kept for tests / callers that still want a one-shot embed.
 */
export async function buildPdfItemsWithImages(
  rows: ExportInventoryRow[],
): Promise<ExportPdfItemBlock[]> {
  const pdfItems = buildPdfItemsForPlanning(rows);

  await embedImagesOnPdfItems(pdfItems);

  return pdfItems;
}

/**
 * Collects unique item objects referenced by a planned page list.
 */
export function collectItemsFromPlannedPages(
  plannedPages: PlannedHousePdfPage[],
): ExportPdfItemBlock[] {
  const seenItems = new Set<ExportPdfItemBlock>();
  const collectedItems: ExportPdfItemBlock[] = [];

  for (const plannedPage of plannedPages) {
    if (plannedPage.page.kind === 'grid') {
      for (const item of plannedPage.page.items) {
        if (seenItems.has(item)) {
          continue;
        }

        seenItems.add(item);
        collectedItems.push(item);
      }
      continue;
    }

    if (seenItems.has(plannedPage.page.item)) {
      continue;
    }

    seenItems.add(plannedPage.page.item);
    collectedItems.push(plannedPage.page.item);
  }

  return collectedItems;
}

/**
 * Loads Base64 data URIs onto the given item blocks (mutates in place).
 */
async function embedImagesOnPdfItems(items: ExportPdfItemBlock[]): Promise<void> {
  for (const item of items) {
    const sourcePaths =
      item.localImagePaths.length > 0
        ? item.localImagePaths
        : item.localImagePath !== null
          ? [item.localImagePath]
          : [];

    const imageDataUris: string[] = [];

    for (const localImagePath of sourcePaths) {
      const imageDataUri = await readLocalImageAsDataUri(localImagePath);

      if (imageDataUri !== null) {
        imageDataUris.push(imageDataUri);
      }
    }

    item.imageDataUris = imageDataUris;
  }
}

/**
 * Clears embedded photo bytes so the next chunk does not keep old Base64 in memory.
 */
function clearImagesOnPdfItems(items: ExportPdfItemBlock[]): void {
  for (const item of items) {
    item.imageDataUris = [];
  }
}

/**
 * Deletes a temp file if it exists (chunk PDFs after merge).
 */
async function deleteTempFileIfExists(fileUri: string): Promise<void> {
  try {
    await FileSystem.deleteAsync(fileUri, { idempotent: true });
  } catch (error) {
    console.log('deleteTempFileIfExists skipped:', error);
  }
}

/**
 * Turns print/OOM failures into a clearer message for the Export screen.
 */
function toFriendlyPdfExportError(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  const looksLikeOutOfMemory =
    /OutOfMemory|out of memory|Failed to allocate/i.test(message);

  if (looksLikeOutOfMemory) {
    return new Error(
      'PDF export ran out of memory. Close other apps and try again, or export CSV instead.',
    );
  }

  if (error instanceof Error) {
    return error;
  }

  return new Error('Could not create the inventory PDF.');
}

/**
 * Creates a CSV or PDF file for a house and opens the system share sheet.
 * PDF path prints in page chunks, then merges into one shareable file.
 */
export async function createAndShareInventoryExport(options: {
  format: InventoryExportFormat;
  houseName: string;
  rows: ExportInventoryRow[];
  onProgress?: (statusMessage: string) => void;
}): Promise<void> {
  const { format, houseName, rows, onProgress } = options;

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

  const reportProgress = (statusMessage: string) => {
    if (onProgress !== undefined) {
      onProgress(statusMessage);
    }
  };

  // Empty house: one small print, no chunking needed.
  if (rows.length === 0) {
    reportProgress('Building PDF…');
    const htmlDocument = buildInventoryPdfHtml({
      houseName,
      generatedAtLabel: new Date().toLocaleString(),
      items: [],
    });
    const printResult = await Print.printToFileAsync({
      html: htmlDocument,
      width: PDF_LANDSCAPE_LETTER_WIDTH,
      height: PDF_LANDSCAPE_LETTER_HEIGHT,
    });

    await Sharing.shareAsync(printResult.uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${houseName} inventory PDF`,
      UTI: 'com.adobe.pdf',
    });
    return;
  }

  reportProgress('Planning PDF pages…');
  const pdfItems = buildPdfItemsForPlanning(rows);
  const plannedPages = planHousePdfDocument(pdfItems);
  const pageChunks = chunkPlannedPdfPages(plannedPages);
  const generatedAtLabel = new Date().toLocaleString();
  const totalPageCount = plannedPages.length;
  const chunkPdfUris: string[] = [];

  try {
    // Print a few pages at a time so Android does not hold the whole house in RAM.
    for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex += 1) {
      const chunkNumber = chunkIndex + 1;
      const plannedPagesChunk = pageChunks[chunkIndex];
      const chunkItems = collectItemsFromPlannedPages(plannedPagesChunk);

      reportProgress(
        `Building PDF chunk ${chunkNumber} of ${pageChunks.length}…`,
      );

      try {
        await embedImagesOnPdfItems(chunkItems);

        const htmlDocument = buildInventoryPdfChunkHtml({
          houseName,
          generatedAtLabel,
          allItemsForMeta: pdfItems,
          plannedPagesChunk,
          totalPageCount,
        });

        const printResult = await Print.printToFileAsync({
          html: htmlDocument,
          width: PDF_LANDSCAPE_LETTER_WIDTH,
          height: PDF_LANDSCAPE_LETTER_HEIGHT,
        });

        chunkPdfUris.push(printResult.uri);
      } catch (error) {
        throw toFriendlyPdfExportError(error);
      } finally {
        // Drop Base64 for this chunk before loading the next one.
        clearImagesOnPdfItems(chunkItems);
      }
    }

    reportProgress('Merging PDF pages…');
    const mergedPdfUri = `${cacheDirectory}home-inventory-${safeHouseName}-${timestampMs}.pdf`;
    await mergePdfFileUris(chunkPdfUris, mergedPdfUri);

    await Sharing.shareAsync(mergedPdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${houseName} inventory PDF`,
      UTI: 'com.adobe.pdf',
    });
  } finally {
    for (const chunkPdfUri of chunkPdfUris) {
      await deleteTempFileIfExists(chunkPdfUri);
    }
  }
}
