// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';

/** Max characters kept from house or item name segments in a photo filename. */
const MAX_FILENAME_NAME_SEGMENT_LENGTH = 40;

/**
 * Strips characters that break file paths / Drive names; keeps letters, numbers, spaces, dashes.
 */
export function sanitizePhotoFileNameSegment(rawText: string): string {
  const trimmedText = rawText.trim();
  const sanitizedText = trimmedText
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (sanitizedText.length === 0) {
    return 'Untitled';
  }

  if (sanitizedText.length > MAX_FILENAME_NAME_SEGMENT_LENGTH) {
    return sanitizedText.slice(0, MAX_FILENAME_NAME_SEGMENT_LENGTH).trim();
  }

  return sanitizedText;
}

/**
 * Temporary unique name used before the item_images row exists (has a DB id).
 */
export function buildStagedItemImageFileName(nowMs: number = Date.now()): string {
  const randomSuffix = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');

  return `staged-${nowMs}-${randomSuffix}.jpg`;
}

/**
 * Final human-readable photo name: "House Name - Item Name - NN - PhotoDatabaseID.jpg".
 * NN is 1-based and zero-padded to 2 digits.
 */
export function buildFinalItemImageFileName(options: {
  houseName: string;
  itemName: string;
  imageNumberOneBased: number;
  photoDatabaseId: number;
}): string {
  const safeHouseName = sanitizePhotoFileNameSegment(options.houseName);
  const safeItemName = sanitizePhotoFileNameSegment(options.itemName);
  const paddedImageNumber = String(options.imageNumberOneBased).padStart(2, '0');

  return `${safeHouseName} - ${safeItemName} - ${paddedImageNumber} - ${options.photoDatabaseId}.jpg`;
}

/**
 * Moves a staged local JPEG to its final filename in the same folder.
 * Returns the new URI (or the original when rename is unnecessary).
 */
export async function renameLocalItemImageFile(options: {
  currentLocalPath: string;
  houseFolderPath: string;
  finalFileName: string;
}): Promise<string> {
  const { currentLocalPath, houseFolderPath, finalFileName } = options;
  const destinationUri = `${houseFolderPath}${finalFileName}`;

  // Already has the intended name — nothing to do.
  if (currentLocalPath === destinationUri) {
    return currentLocalPath;
  }

  await FileSystem.moveAsync({
    from: currentLocalPath,
    to: destinationUri,
  });

  return destinationUri;
}
