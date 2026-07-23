import { PDFDocument } from 'pdf-lib';

jest.mock('expo-file-system/legacy', () => ({
  EncodingType: {
    Base64: 'base64',
  },
  readAsStringAsync: jest.fn(),
  writeAsStringAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';
import {
  decodeBase64ToBytes,
  encodeBytesToBase64,
  mergePdfFileUris,
} from '@/lib/mergePdfFiles';

describe('encodeBytesToBase64 / decodeBase64ToBytes', () => {
  test('round-trips raw bytes', () => {
    const originalBytes = new Uint8Array([1, 2, 255, 0, 128]);
    const encoded = encodeBytesToBase64(originalBytes);
    const decoded = decodeBase64ToBytes(encoded);

    expect(Array.from(decoded)).toEqual(Array.from(originalBytes));
  });
});

describe('mergePdfFileUris', () => {
  beforeEach(() => {
    jest.mocked(FileSystem.readAsStringAsync).mockReset();
    jest.mocked(FileSystem.writeAsStringAsync).mockReset();
  });

  test('throws when there are no chunks', async () => {
    await expect(mergePdfFileUris([], 'file:///out.pdf')).rejects.toThrow(
      /No PDF chunks/i,
    );
  });

  test('merges chunk PDFs in order into one file', async () => {
    const firstDocument = await PDFDocument.create();
    firstDocument.addPage();
    const secondDocument = await PDFDocument.create();
    secondDocument.addPage();
    secondDocument.addPage();

    const firstBase64 = encodeBytesToBase64(await firstDocument.save());
    const secondBase64 = encodeBytesToBase64(await secondDocument.save());

    jest.mocked(FileSystem.readAsStringAsync).mockImplementation(async (uri) => {
      if (uri === 'file:///chunk-1.pdf') {
        return firstBase64;
      }

      if (uri === 'file:///chunk-2.pdf') {
        return secondBase64;
      }

      throw new Error(`Unexpected URI: ${uri}`);
    });

    let writtenBase64 = '';
    jest
      .mocked(FileSystem.writeAsStringAsync)
      .mockImplementation(async (_uri, contents) => {
        writtenBase64 = String(contents);
      });

    const outputUri = await mergePdfFileUris(
      ['file:///chunk-1.pdf', 'file:///chunk-2.pdf'],
      'file:///merged.pdf',
    );

    expect(outputUri).toBe('file:///merged.pdf');
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
      'file:///merged.pdf',
      expect.any(String),
      expect.objectContaining({ encoding: 'base64' }),
    );

    const mergedDocument = await PDFDocument.load(
      decodeBase64ToBytes(writtenBase64),
    );
    expect(mergedDocument.getPageCount()).toBe(3);
  });
});
