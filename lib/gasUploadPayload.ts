import type { GasUploadItem } from '@/types/gasSync';

/** How many items to send in each upload POST (keeps Apps Script under size/time limits). */
export const GAS_UPLOAD_BATCH_SIZE = 5;

/**
 * Strips photo bytes from upload items for duplicate checks.
 * Analogy: showing the clerk your name tags only — photos stay in the box until upload.
 */
export function toDuplicateCheckItems(
  uploadItems: GasUploadItem[],
): GasUploadItem[] {
  return uploadItems.map((uploadItem) => ({
    ...uploadItem,
    imageBase64: null,
    images: [],
  }));
}

/**
 * Splits upload items into fixed-size batches for sequential POSTs.
 */
export function chunkGasUploadItems(
  uploadItems: GasUploadItem[],
  batchSize: number = GAS_UPLOAD_BATCH_SIZE,
): GasUploadItem[][] {
  if (batchSize <= 0) {
    throw new Error('batchSize must be greater than 0.');
  }

  const batches: GasUploadItem[][] = [];

  // Walk the list in steps of batchSize and slice each window.
  for (
    let startIndex = 0;
    startIndex < uploadItems.length;
    startIndex += batchSize
  ) {
    batches.push(uploadItems.slice(startIndex, startIndex + batchSize));
  }

  return batches;
}
