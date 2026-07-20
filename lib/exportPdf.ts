import type { ExportInventoryRow } from '@/types/inventory';

/**
 * Escapes text so it is safe inside an HTML document.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export type ExportPdfItemBlock = ExportInventoryRow & {
  /** data:image/jpeg;base64,... or null when there is no photo. */
  imageDataUri: string | null;
};

/**
 * Builds the HTML document used by expo-print (Option A: details + photos).
 */
export function buildInventoryPdfHtml(options: {
  houseName: string;
  generatedAtLabel: string;
  items: ExportPdfItemBlock[];
}): string {
  const { houseName, generatedAtLabel, items } = options;

  const itemSections = items
    .map((item) => {
      const imageHtml =
        item.imageDataUri !== null
          ? `<img class="photo" src="${item.imageDataUri}" alt="${escapeHtml(item.itemName)}" />`
          : `<div class="photo-missing">No photo</div>`;

      return `
      <section class="item">
        ${imageHtml}
        <h2>${escapeHtml(item.itemName)}</h2>
        <p><strong>Room:</strong> ${escapeHtml(item.roomName)}</p>
        <p><strong>Brand:</strong> ${escapeHtml(item.brand.length > 0 ? item.brand : '—')}</p>
        <p><strong>Category:</strong> ${escapeHtml(
          item.categoryName.length > 0 ? item.categoryName : '—',
        )}</p>
        <p><strong>Purchase price:</strong> $${item.purchasePriceUsd.toFixed(2)}</p>
        <p><strong>Purchase year:</strong> ${escapeHtml(
          item.purchaseYear.length > 0 ? item.purchaseYear : '—',
        )}</p>
        <p><strong>Description:</strong> ${escapeHtml(
          item.description.length > 0 ? item.description : '—',
        )}</p>
      </section>`;
    })
    .join('\n');

  const emptyMessage =
    items.length === 0
      ? '<p class="empty">No items in this house yet.</p>'
      : '';

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(houseName)} Inventory</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #111827;
        padding: 24px;
        line-height: 1.4;
      }
      h1 { font-size: 24px; margin: 0 0 4px; }
      .meta { color: #6b7280; margin-bottom: 24px; }
      .item {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 16px;
        page-break-inside: avoid;
      }
      .item h2 { font-size: 18px; margin: 12px 0 8px; }
      .item p { margin: 4px 0; font-size: 13px; }
      .photo {
        width: 100%;
        max-height: 280px;
        object-fit: contain;
        background: #f3f4f6;
        border-radius: 6px;
      }
      .photo-missing {
        height: 120px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f4f6;
        color: #6b7280;
        border-radius: 6px;
        font-size: 13px;
      }
      .empty { color: #6b7280; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(houseName)} — Home Inventory</h1>
    <p class="meta">Generated ${escapeHtml(generatedAtLabel)} · ${items.length} item(s)</p>
    ${emptyMessage}
    ${itemSections}
  </body>
</html>`;
}
