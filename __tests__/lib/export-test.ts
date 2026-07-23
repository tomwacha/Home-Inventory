import { buildInventoryCsv, escapeCsvField } from '@/lib/exportCsv';
import {
  buildHousePdfMetaLine,
  buildInventoryPdfChunkHtml,
  buildInventoryPdfHtml,
  chunkItemsForPdfPages,
  chunkPlannedPdfPages,
  escapeHtml,
  getPdfPhotoCount,
  groupItemsByRoom,
  planHousePdfDocument,
  planRoomPages,
  PDF_GRID_ITEMS_PER_PAGE,
  PDF_LANDSCAPE_LETTER_HEIGHT,
  PDF_LANDSCAPE_LETTER_WIDTH,
  PDF_PRINT_CHUNK_MAX_PAGES,
  sumHousePurchaseValueUsd,
} from '@/lib/exportPdf';
import type { ExportInventoryRow } from '@/types/inventory';

const sampleRows: ExportInventoryRow[] = [
  {
    roomName: 'Kitchen',
    itemName: 'Blender',
    brand: 'Acme',
    model: 'X100',
    categoryName: 'Appliances',
    purchasePriceUsd: 49.5,
    purchaseDate: '2020-01-01',
    description: 'Red, works well',
    localImagePath: 'file:///photo.jpg',
    localImagePaths: ['file:///photo.jpg', 'file:///photo-2.jpg'],
    photoCount: 2,
    driveImageUrls: [
      'https://drive.example/1',
      'https://drive.example/2',
    ],
  },
  {
    roomName: 'Office',
    itemName: 'Desk, "oak"',
    brand: '',
    model: '',
    categoryName: '',
    purchasePriceUsd: 200,
    purchaseDate: '',
    description: 'Line1; Line2',
    localImagePath: null,
    localImagePaths: [],
    photoCount: 0,
    driveImageUrls: [],
  },
];

function buildPdfItem(
  overrides: Partial<ExportInventoryRow> & {
    itemName: string;
    imageDataUris: string[];
  },
) {
  return {
    ...sampleRows[0],
    brand: 'Brand',
    model: 'Model',
    categoryName: 'Category',
    purchasePriceUsd: 10,
    purchaseDate: '2020-01-01',
    description: 'Desc',
    localImagePath: null,
    localImagePaths: [],
    photoCount: overrides.imageDataUris.length,
    driveImageUrls: [],
    roomName: 'Kitchen',
    ...overrides,
  };
}

describe('escapeCsvField', () => {
  test('leaves simple text alone', () => {
    expect(escapeCsvField('Kitchen')).toBe('Kitchen');
  });

  test('wraps values that contain commas or quotes', () => {
    expect(escapeCsvField('Desk, "oak"')).toBe('"Desk, ""oak"""');
  });

  test('wraps values that contain newlines', () => {
    expect(escapeCsvField('Line1\nLine2')).toBe('"Line1\nLine2"');
  });
});

describe('buildInventoryCsv', () => {
  test('builds a header and one line per item', () => {
    const csvText = buildInventoryCsv(sampleRows);
    const lines = csvText.split('\n');

    expect(lines[0]).toContain('Room');
    expect(lines[0]).toContain('Model');
    expect(lines[0]).toContain('Purchase Date');
    expect(lines[0]).toContain('Photo Count');
    expect(lines[0]).toContain('Primary Photo');
    expect(lines[0]).toContain('Additional Photo 1');
    expect(lines[0]).toContain('Additional Photo 4');
    expect(lines[0]).toContain('Has Local Photo');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Blender');
    expect(lines[1]).toContain('X100');
    expect(lines[1]).toContain('2020-01-01');
    expect(lines[1]).toContain('https://drive.example/1');
    expect(lines[1]).toContain('https://drive.example/2');
    expect(lines[1]).toContain('2');
    expect(lines[1]).toContain('yes');
    expect(lines[2]).toContain('no');
    expect(lines[2]).toContain('"Desk, ""oak"""');
  });

  test('exports at most five Drive photo links in separate columns', () => {
    const rowWithSixPhotos: ExportInventoryRow = {
      ...sampleRows[0],
      photoCount: 6,
      driveImageUrls: [
        'https://drive.example/1',
        'https://drive.example/2',
        'https://drive.example/3',
        'https://drive.example/4',
        'https://drive.example/5',
        'https://drive.example/6',
      ],
    };

    const csvText = buildInventoryCsv([rowWithSixPhotos]);
    const dataLine = csvText.split('\n')[1];

    expect(dataLine).toContain('https://drive.example/5');
    expect(dataLine).not.toContain('https://drive.example/6');
  });
});

describe('escapeHtml', () => {
  test('escapes angle brackets and ampersands', () => {
    expect(escapeHtml('A <B> & C')).toBe('A &lt;B&gt; &amp; C');
  });
});

describe('chunkItemsForPdfPages', () => {
  test('chunks inventory cards into pages of four', () => {
    const pages = chunkItemsForPdfPages([1, 2, 3, 4, 5], PDF_GRID_ITEMS_PER_PAGE);

    expect(pages).toEqual([[1, 2, 3, 4], [5]]);
  });
});

describe('groupItemsByRoom', () => {
  test('keeps consecutive room groups in order', () => {
    const roomSections = groupItemsByRoom([
      {
        ...sampleRows[0],
        itemName: 'Blender',
        imageDataUris: [],
      },
      {
        ...sampleRows[0],
        itemName: 'Toaster',
        imageDataUris: [],
      },
      {
        ...sampleRows[1],
        itemName: 'Desk',
        imageDataUris: [],
      },
    ]);

    expect(roomSections).toHaveLength(2);
    expect(roomSections[0].roomName).toBe('Kitchen');
    expect(roomSections[0].items.map((item) => item.itemName)).toEqual([
      'Blender',
      'Toaster',
    ]);
    expect(roomSections[1].roomName).toBe('Office');
    expect(roomSections[1].items.map((item) => item.itemName)).toEqual(['Desk']);
  });
});

describe('planRoomPages', () => {
  test('fills a 2x2 grid before a queued multi-photo page', () => {
    const pages = planRoomPages([
      buildPdfItem({ itemName: 'A', imageDataUris: ['data:a'] }),
      buildPdfItem({
        itemName: 'M',
        imageDataUris: ['data:m1', 'data:m2'],
      }),
      buildPdfItem({ itemName: 'B', imageDataUris: ['data:b'] }),
      buildPdfItem({ itemName: 'C', imageDataUris: [] }),
      buildPdfItem({ itemName: 'D', imageDataUris: ['data:d'] }),
    ]);

    expect(pages).toHaveLength(2);
    expect(pages[0]).toEqual({
      kind: 'grid',
      items: expect.arrayContaining([
        expect.objectContaining({ itemName: 'A' }),
        expect.objectContaining({ itemName: 'B' }),
        expect.objectContaining({ itemName: 'C' }),
        expect.objectContaining({ itemName: 'D' }),
      ]),
    });
    expect(pages[0].kind === 'grid' && pages[0].items.map((item) => item.itemName)).toEqual([
      'A',
      'B',
      'C',
      'D',
    ]);
    expect(pages[1]).toEqual({
      kind: 'multiPhoto',
      item: expect.objectContaining({ itemName: 'M' }),
    });
  });

  test('emits a partial grid then remaining multi-photo pages at room end', () => {
    const pages = planRoomPages([
      buildPdfItem({ itemName: 'A', imageDataUris: ['data:a'] }),
      buildPdfItem({
        itemName: 'M',
        imageDataUris: ['data:m1', 'data:m2'],
      }),
      buildPdfItem({ itemName: 'B', imageDataUris: [] }),
    ]);

    expect(pages).toHaveLength(2);
    expect(pages[0].kind === 'grid' && pages[0].items.map((item) => item.itemName)).toEqual([
      'A',
      'B',
    ]);
    expect(pages[1].kind === 'multiPhoto' && pages[1].item.itemName).toBe('M');
  });
});

describe('house PDF totals', () => {
  test('sums purchase values and formats the meta line', () => {
    expect(
      sumHousePurchaseValueUsd([
        buildPdfItem({ itemName: 'A', purchasePriceUsd: 10, imageDataUris: [] }),
        buildPdfItem({ itemName: 'B', purchasePriceUsd: 5.5, imageDataUris: [] }),
      ]),
    ).toBe(15.5);

    expect(
      buildHousePdfMetaLine({
        generatedAtLabel: '7/20/2026, 9:00:00 AM',
        itemCount: 2,
        totalValueUsd: 15.5,
      }),
    ).toBe('Generated 7/20/2026, 9:00:00 AM · 2 items · $15.50');
  });
});

describe('buildInventoryPdfHtml', () => {
  test('uses landscape Letter assumptions and a 2x2 grid with house totals', () => {
    const htmlDocument = buildInventoryPdfHtml({
      houseName: 'Beach House',
      generatedAtLabel: '7/20/2026, 9:00:00 AM',
      items: [
        {
          ...sampleRows[1],
          itemName: 'Chair',
          purchasePriceUsd: 100,
          imageDataUris: [],
        },
        {
          ...sampleRows[1],
          itemName: 'Lamp',
          purchasePriceUsd: 25.5,
          imageDataUris: ['data:image/jpeg;base64,aaa'],
        },
      ],
    });

    expect(htmlDocument).toContain('data-pdf-orientation="landscape-letter"');
    expect(htmlDocument).toContain(
      `size: ${PDF_LANDSCAPE_LETTER_WIDTH}pt ${PDF_LANDSCAPE_LETTER_HEIGHT}pt`,
    );
    expect(htmlDocument).toContain('grid-template-columns: 1fr 1fr');
    expect(htmlDocument).toContain('data-pdf-grid-page="true"');
    expect(htmlDocument).not.toContain('Landscape Letter 2×2 by room');
    expect(htmlDocument).toContain(
      'Generated 7/20/2026, 9:00:00 AM · 2 items · $125.50',
    );
    expect(htmlDocument).toContain('Chair');
    expect(htmlDocument).toContain('Lamp');
  });

  test('renders a room heading before each room grid and keeps rooms separate', () => {
    const htmlDocument = buildInventoryPdfHtml({
      houseName: 'Beach House',
      generatedAtLabel: '7/20/2026',
      items: [
        {
          ...sampleRows[0],
          itemName: 'Blender',
          imageDataUris: ['data:image/jpeg;base64,abc'],
        },
        {
          ...sampleRows[1],
          itemName: 'Desk',
          imageDataUris: [],
        },
      ],
    });

    expect(htmlDocument).toContain('Beach House — Home Inventory');
    expect(htmlDocument).toContain('data-pdf-room-section="true"');
    expect(htmlDocument).toContain('data-room-section="true"');
    expect(htmlDocument).toContain('<h2>Kitchen</h2>');
    expect(htmlDocument).toContain('<h2>Office</h2>');

    const kitchenIndex = htmlDocument.indexOf('<h2>Kitchen</h2>');
    const blenderIndex = htmlDocument.indexOf('Blender');
    const officeIndex = htmlDocument.indexOf('<h2>Office</h2>');
    const deskIndex = htmlDocument.indexOf('>Desk<');

    expect(kitchenIndex).toBeGreaterThan(-1);
    expect(blenderIndex).toBeGreaterThan(kitchenIndex);
    expect(officeIndex).toBeGreaterThan(blenderIndex);
    expect(deskIndex).toBeGreaterThan(officeIndex);
    expect(htmlDocument).toContain('page-break-before: always');
    expect(htmlDocument).toContain('<span>Beach House - Kitchen</span>');
    expect(htmlDocument).toContain('<span>Beach House - Office</span>');
    expect(htmlDocument).toContain('<span>Page 1 of 2</span>');
    expect(htmlDocument).toContain('<span>Page 2 of 2</span>');
    expect(htmlDocument.match(/data-pdf-page-footer="true"/g)).toHaveLength(2);
  });

  test('keeps multi-photo items off the grid and on dedicated pages after a filled grid', () => {
    const htmlDocument = buildInventoryPdfHtml({
      houseName: 'Beach House',
      generatedAtLabel: '7/20/2026, 9:00:00 AM',
      items: [
        buildPdfItem({ itemName: 'A', imageDataUris: ['data:a'], purchasePriceUsd: 1 }),
        buildPdfItem({
          itemName: 'M',
          imageDataUris: ['data:m1', 'data:m2'],
          purchasePriceUsd: 2,
          brand: 'Multi Brand',
          model: 'Multi Model',
          categoryName: 'Multi Category',
          purchaseDate: '2021-02-03',
          description: 'Multi description',
        }),
        buildPdfItem({ itemName: 'B', imageDataUris: ['data:b'], purchasePriceUsd: 3 }),
        buildPdfItem({ itemName: 'C', imageDataUris: [], purchasePriceUsd: 4 }),
        buildPdfItem({ itemName: 'D', imageDataUris: ['data:d'], purchasePriceUsd: 5 }),
        {
          ...sampleRows[1],
          itemName: 'Desk',
          purchasePriceUsd: 0,
          imageDataUris: [],
        },
      ],
    });

    expect(htmlDocument).toContain(
      'Generated 7/20/2026, 9:00:00 AM · 6 items · $15.00',
    );
    expect(htmlDocument).toContain('data-grid-item-name="A"');
    expect(htmlDocument).toContain('data-grid-item-name="B"');
    expect(htmlDocument).toContain('data-grid-item-name="C"');
    expect(htmlDocument).toContain('data-grid-item-name="D"');
    expect(htmlDocument).not.toContain('data-grid-item-name="M"');
    expect(htmlDocument).toContain('data-photo-item-name="M"');
    expect(htmlDocument).toContain('data-item-photo-page="true"');
    expect(htmlDocument).toContain('data-photo-count="2"');
    expect(htmlDocument).toContain('data-photo-item-details="true"');
    expect(htmlDocument).toContain('<strong>Brand:</strong> Multi Brand');
    expect(htmlDocument).toContain('<strong>Model:</strong> Multi Model');
    expect(htmlDocument).toContain('<strong>Category:</strong> Multi Category');
    expect(htmlDocument).toContain('<strong>Purchase price:</strong> $2.00');
    expect(htmlDocument).toContain('<strong>Purchase date:</strong> 2021-02-03');
    expect(htmlDocument).toContain(
      '<strong>Description:</strong> Multi description',
    );

    const gridAIndex = htmlDocument.indexOf('data-grid-item-name="A"');
    const photoMIndex = htmlDocument.indexOf('data-photo-item-name="M"');
    const officeIndex = htmlDocument.indexOf('<h2>Office</h2>');

    expect(gridAIndex).toBeGreaterThan(-1);
    expect(photoMIndex).toBeGreaterThan(gridAIndex);
    expect(officeIndex).toBeGreaterThan(photoMIndex);
    expect(htmlDocument).toContain('<span>Beach House - Kitchen</span>');
    expect(htmlDocument).toContain('<span>Beach House - Office</span>');
    expect(htmlDocument).toContain('<span>Page 1 of 3</span>');
    expect(htmlDocument).toContain('<span>Page 2 of 3</span>');
    expect(htmlDocument).toContain('<span>Page 3 of 3</span>');
    expect(htmlDocument.match(/data-pdf-page-footer="true"/g)).toHaveLength(3);
  });

  test('shows a page 1 of 1 footer for an empty house', () => {
    const htmlDocument = buildInventoryPdfHtml({
      houseName: 'Empty House',
      generatedAtLabel: '7/20/2026, 9:00:00 AM',
      items: [],
    });

    expect(htmlDocument).toContain('No items in this house yet.');
    expect(htmlDocument).toContain('<span>Empty House</span>');
    expect(htmlDocument).toContain('<span>Page 1 of 1</span>');
    expect(htmlDocument.match(/data-pdf-page-footer="true"/g)).toHaveLength(1);
  });
});

describe('getPdfPhotoCount and planning without Base64', () => {
  test('treats localImagePaths as multi-photo when imageDataUris are empty', () => {
    const item = buildPdfItem({
      itemName: 'Camera',
      imageDataUris: [],
      localImagePaths: ['file:///a.jpg', 'file:///b.jpg'],
      photoCount: 2,
    });

    expect(getPdfPhotoCount(item)).toBe(2);
    expect(planRoomPages([item])[0].kind).toBe('multiPhoto');
  });
});

describe('planHousePdfDocument and chunkPlannedPdfPages', () => {
  test('uses default chunk size of 8', () => {
    expect(PDF_PRINT_CHUNK_MAX_PAGES).toBe(8);
  });

  test('splits 17 planned pages into chunks of 8, 8, and 1', () => {
    // 17 single-item rooms → 17 grid pages (one item each).
    const items = Array.from({ length: 17 }, (_, index) =>
      buildPdfItem({
        itemName: `Item ${index + 1}`,
        roomName: `Room ${index + 1}`,
        imageDataUris: [],
      }),
    );

    const plannedPages = planHousePdfDocument(items);
    expect(plannedPages).toHaveLength(17);
    expect(plannedPages[0].pageNumber).toBe(1);
    expect(plannedPages[16].pageNumber).toBe(17);

    const chunks = chunkPlannedPdfPages(plannedPages);
    expect(chunks.map((chunk) => chunk.length)).toEqual([8, 8, 1]);
    expect(chunks[0][0].pageNumber).toBe(1);
    expect(chunks[1][0].pageNumber).toBe(9);
    expect(chunks[2][0].pageNumber).toBe(17);
  });
});

describe('buildInventoryPdfChunkHtml', () => {
  test('keeps global page numbers and omits house header on a mid-document chunk', () => {
    const items = Array.from({ length: 10 }, (_, index) =>
      buildPdfItem({
        itemName: `Item ${index + 1}`,
        roomName: `Room ${index + 1}`,
        imageDataUris: [],
        purchasePriceUsd: 1,
      }),
    );
    const plannedPages = planHousePdfDocument(items);
    const secondChunk = chunkPlannedPdfPages(plannedPages, 8)[1];

    const htmlDocument = buildInventoryPdfChunkHtml({
      houseName: 'Beach House',
      generatedAtLabel: '7/20/2026, 9:00:00 AM',
      allItemsForMeta: items,
      plannedPagesChunk: secondChunk,
      totalPageCount: plannedPages.length,
    });

    expect(htmlDocument).not.toContain('Beach House — Home Inventory');
    expect(htmlDocument).toContain('<span>Page 9 of 10</span>');
    expect(htmlDocument).toContain('<span>Page 10 of 10</span>');
    expect(htmlDocument).not.toContain('<span>Page 1 of 10</span>');
  });
});
