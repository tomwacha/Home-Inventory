import { PDFDocument } from 'pdf-lib';

// SDK 54: classic FileSystem API lives under /legacy.
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Decodes a Base64 string into raw bytes for pdf-lib.
 * Analogy: turning a packed suitcase label back into the actual suitcase contents.
 */
export function decodeBase64ToBytes(base64Text: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64Text, 'base64'));
  }

  const binaryText = globalThis.atob(base64Text);
  const bytes = new Uint8Array(binaryText.length);

  for (let byteIndex = 0; byteIndex < binaryText.length; byteIndex += 1) {
    bytes[byteIndex] = binaryText.charCodeAt(byteIndex);
  }

  return bytes;
}

/**
 * Encodes raw bytes as Base64 for writing with expo-file-system.
 */
export function encodeBytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  let binaryText = '';

  for (let byteIndex = 0; byteIndex < bytes.length; byteIndex += 1) {
    binaryText += String.fromCharCode(bytes[byteIndex]);
  }

  return globalThis.btoa(binaryText);
}

/**
 * Merges ordered PDF file URIs into one PDF at outputUri.
 * Returns the outputUri for sharing.
 */
export async function mergePdfFileUris(
  chunkPdfUris: string[],
  outputUri: string,
): Promise<string> {
  if (chunkPdfUris.length === 0) {
    throw new Error('No PDF chunks to merge.');
  }

  const mergedPdf = await PDFDocument.create();

  // Copy every page from each chunk, in order, into the final document.
  for (const chunkPdfUri of chunkPdfUris) {
    const chunkBase64 = await FileSystem.readAsStringAsync(chunkPdfUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const chunkPdf = await PDFDocument.load(decodeBase64ToBytes(chunkBase64));
    const copiedPages = await mergedPdf.copyPages(
      chunkPdf,
      chunkPdf.getPageIndices(),
    );

    for (const copiedPage of copiedPages) {
      mergedPdf.addPage(copiedPage);
    }
  }

  const mergedBytes = await mergedPdf.save();
  const mergedBase64 = encodeBytesToBase64(mergedBytes);

  await FileSystem.writeAsStringAsync(outputUri, mergedBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return outputUri;
}
