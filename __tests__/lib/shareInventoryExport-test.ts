import {
  buildPdfItemsForPlanning,
  collectItemsFromPlannedPages,
} from '@/lib/shareInventoryExport';
import { planHousePdfDocument } from '@/lib/exportPdf';
import type { ExportInventoryRow } from '@/types/inventory';

const sampleRow: ExportInventoryRow = {
  roomName: 'Kitchen',
  itemName: 'Blender',
  brand: 'Acme',
  model: 'X100',
  categoryName: 'Appliances',
  purchasePriceUsd: 49.5,
  purchaseDate: '2020-01-01',
  description: 'Red',
  localImagePath: 'file:///photo.jpg',
  localImagePaths: ['file:///photo.jpg', 'file:///photo-2.jpg'],
  photoCount: 2,
  driveImageUrls: [],
};

describe('buildPdfItemsForPlanning', () => {
  test('keeps path metadata and leaves imageDataUris empty', () => {
    const pdfItems = buildPdfItemsForPlanning([sampleRow]);

    expect(pdfItems).toHaveLength(1);
    expect(pdfItems[0].imageDataUris).toEqual([]);
    expect(pdfItems[0].localImagePaths).toEqual([
      'file:///photo.jpg',
      'file:///photo-2.jpg',
    ]);
  });
});

describe('collectItemsFromPlannedPages', () => {
  test('returns unique item references used by a page chunk', () => {
    const pdfItems = buildPdfItemsForPlanning([
      sampleRow,
      {
        ...sampleRow,
        roomName: 'Office',
        itemName: 'Desk',
        localImagePath: null,
        localImagePaths: [],
        photoCount: 0,
      },
    ]);

    const plannedPages = planHousePdfDocument(pdfItems);
    const collectedItems = collectItemsFromPlannedPages(plannedPages);

    expect(collectedItems).toHaveLength(2);
    expect(collectedItems.map((item) => item.itemName).sort()).toEqual([
      'Blender',
      'Desk',
    ]);
    // Same object references as planning — so later Base64 embeds update the pages.
    expect(collectedItems[0]).toBe(pdfItems.find((item) => item.itemName === collectedItems[0].itemName));
  });
});
