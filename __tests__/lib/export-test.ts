import { buildInventoryCsv, escapeCsvField } from '@/lib/exportCsv';
import { buildInventoryPdfHtml, escapeHtml } from '@/lib/exportPdf';
import type { ExportInventoryRow } from '@/types/inventory';

const sampleRows: ExportInventoryRow[] = [
  {
    roomName: 'Kitchen',
    itemName: 'Blender',
    brand: 'Acme',
    categoryName: 'Appliances',
    purchasePriceUsd: 49.5,
    purchaseYear: '2020',
    description: 'Red, works well',
    localImagePath: 'file:///photo.jpg',
  },
  {
    roomName: 'Office',
    itemName: 'Desk, "oak"',
    brand: '',
    categoryName: '',
    purchasePriceUsd: 200,
    purchaseYear: '',
    description: 'Line1; Line2',
    localImagePath: null,
  },
];

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
    expect(lines[0]).toContain('Has Local Photo');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('Blender');
    expect(lines[1]).toContain('yes');
    expect(lines[2]).toContain('no');
    expect(lines[2]).toContain('"Desk, ""oak"""');
  });
});

describe('escapeHtml', () => {
  test('escapes angle brackets and ampersands', () => {
    expect(escapeHtml('A <B> & C')).toBe('A &lt;B&gt; &amp; C');
  });
});

describe('buildInventoryPdfHtml', () => {
  test('includes house name, item details, and photo placeholder', () => {
    const htmlDocument = buildInventoryPdfHtml({
      houseName: 'Beach House',
      generatedAtLabel: '7/20/2026',
      items: [
        {
          ...sampleRows[0],
          imageDataUri: 'data:image/jpeg;base64,abc',
        },
        {
          ...sampleRows[1],
          imageDataUri: null,
        },
      ],
    });

    expect(htmlDocument).toContain('Beach House');
    expect(htmlDocument).toContain('Blender');
    expect(htmlDocument).toContain('data:image/jpeg;base64,abc');
    expect(htmlDocument).toContain('No photo');
    expect(htmlDocument).toContain('$49.50');
  });
});
