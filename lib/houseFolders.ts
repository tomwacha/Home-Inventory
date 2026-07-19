// SDK 54 moved the classic FileSystem API to /legacy; new API is the default.
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Turns a house name into a safe folder name (letters, numbers, dashes).
 * Analogy: like renaming a file so the OS won't choke on weird characters.
 */
export function buildSafeHouseFolderName(houseName: string): string {
  const trimmedName = houseName.trim();
  const sanitizedName = trimmedName
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .replace(/\s+/g, '-');

  if (sanitizedName.length === 0) {
    return `house-${Date.now()}`;
  }

  return sanitizedName;
}

/**
 * Creates documentDirectory/houses/{name}/ and returns the absolute folder URI.
 * This is where item images for that house will live later.
 */
export async function createHouseFolderOnDevice(houseName: string): Promise<string> {
  const documentDirectory = FileSystem.documentDirectory;

  if (documentDirectory === null) {
    throw new Error('Document directory is not available on this device.');
  }

  const housesRootDirectory = `${documentDirectory}houses/`;
  await FileSystem.makeDirectoryAsync(housesRootDirectory, { intermediates: true });

  const safeFolderName = buildSafeHouseFolderName(houseName);
  let houseFolderPath = `${housesRootDirectory}${safeFolderName}/`;

  // If that folder already exists, append a timestamp so names stay unique.
  const existingFolderInfo = await FileSystem.getInfoAsync(houseFolderPath);
  if (existingFolderInfo.exists) {
    houseFolderPath = `${housesRootDirectory}${safeFolderName}-${Date.now()}/`;
  }

  await FileSystem.makeDirectoryAsync(houseFolderPath, { intermediates: true });

  return houseFolderPath;
}
