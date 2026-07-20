// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

/** Longest side after downscale (Feature 11). */
export const MAX_IMAGE_DIMENSION_PX = 1024;

/** JPEG quality after capture (Feature 11). */
export const JPEG_COMPRESS_QUALITY = 0.7;

export type ImageSourceChoice = 'camera' | 'gallery';

/**
 * Builds a unique JPEG file name for an item photo.
 * Analogy: a sticky label with a timestamp so two photos never share a name.
 */
export function buildItemImageFileName(nowMs: number = Date.now()): string {
  return `item-${nowMs}.jpg`;
}

/**
 * Chooses a resize action so the longest side is at most maxDimensionPx.
 * Returns null when the image is already small enough (no resize needed).
 */
export function buildResizeActionForMaxDimension(
  widthPx: number,
  heightPx: number,
  maxDimensionPx: number = MAX_IMAGE_DIMENSION_PX,
): ImageManipulator.Action | null {
  // Already within the limit — skip resize (we still re-encode as JPEG below).
  if (widthPx <= maxDimensionPx && heightPx <= maxDimensionPx) {
    return null;
  }

  // Landscape (or square): shrink width; height follows to keep aspect ratio.
  if (widthPx >= heightPx) {
    return {
      resize: {
        width: maxDimensionPx,
      },
    };
  }

  // Portrait: shrink height; width follows.
  return {
    resize: {
      height: maxDimensionPx,
    },
  };
}

/**
 * Asks for camera or photo-library permission. Returns false if the user denies.
 */
async function ensureImagePermission(source: ImageSourceChoice): Promise<boolean> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    return permission.granted;
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted;
}

/**
 * Downscales (if needed) and re-encodes as JPEG 0.7, then copies into the house folder.
 * Returns the permanent local file URI stored under that house.
 */
export async function processAndSaveItemImage(options: {
  sourceImageUri: string;
  sourceWidthPx: number;
  sourceHeightPx: number;
  houseFolderPath: string;
  nowMs?: number;
}): Promise<string> {
  const {
    sourceImageUri,
    sourceWidthPx,
    sourceHeightPx,
    houseFolderPath,
    nowMs = Date.now(),
  } = options;

  const resizeAction = buildResizeActionForMaxDimension(sourceWidthPx, sourceHeightPx);
  const manipulateActions: ImageManipulator.Action[] =
    resizeAction === null ? [] : [resizeAction];

  // Re-encode even when no resize is needed so gallery HEIC/PNG become compact JPEG.
  const manipulatedImage = await ImageManipulator.manipulateAsync(
    sourceImageUri,
    manipulateActions,
    {
      compress: JPEG_COMPRESS_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  // Ensure the house folder exists (should already from Add House, but be safe).
  await FileSystem.makeDirectoryAsync(houseFolderPath, { intermediates: true });

  const destinationFileName = buildItemImageFileName(nowMs);
  const destinationUri = `${houseFolderPath}${destinationFileName}`;

  await FileSystem.copyAsync({
    from: manipulatedImage.uri,
    to: destinationUri,
  });

  return destinationUri;
}

/**
 * Full pipeline: pick from camera/gallery → downscale → save into house folder.
 * Returns null when the user cancels the picker.
 */
export async function pickDownscaleAndSaveItemImage(options: {
  source: ImageSourceChoice;
  houseFolderPath: string;
}): Promise<string | null> {
  const { source, houseFolderPath } = options;

  const hasPermission = await ensureImagePermission(source);

  if (!hasPermission) {
    throw new Error(
      source === 'camera'
        ? 'Camera permission was denied. Enable it in system settings to photograph items.'
        : 'Photo library permission was denied. Enable it in system settings to attach pictures.',
    );
  }

  const pickerOptions: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
  };

  const pickerResult =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(pickerOptions)
      : await ImagePicker.launchImageLibraryAsync(pickerOptions);

  if (pickerResult.canceled || pickerResult.assets.length === 0) {
    return null;
  }

  const pickedAsset = pickerResult.assets[0];

  return processAndSaveItemImage({
    sourceImageUri: pickedAsset.uri,
    sourceWidthPx: pickedAsset.width,
    sourceHeightPx: pickedAsset.height,
    houseFolderPath,
  });
}

/**
 * Best-effort delete of a previous item photo (ignores missing files).
 */
export async function deleteLocalImageIfExists(localImagePath: string | null): Promise<void> {
  if (localImagePath === null || localImagePath.length === 0) {
    return;
  }

  try {
    const fileInfo = await FileSystem.getInfoAsync(localImagePath);

    if (fileInfo.exists) {
      await FileSystem.deleteAsync(localImagePath, { idempotent: true });
    }
  } catch (error) {
    console.log('deleteLocalImageIfExists skipped:', error);
  }
}
