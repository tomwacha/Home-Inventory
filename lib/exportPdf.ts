import type { ExportInventoryRow } from '@/types/inventory';

/** US Letter landscape points for expo-print (11" × 8.5" at 72 dpi). */
export const PDF_LANDSCAPE_LETTER_WIDTH = 792;
export const PDF_LANDSCAPE_LETTER_HEIGHT = 612;

/** How many inventory cards fit on one landscape page (2×2). */
export const PDF_GRID_ITEMS_PER_PAGE = 4;

/** Max landscape pages per expo-print call (then merge into one PDF). */
export const PDF_PRINT_CHUNK_MAX_PAGES = 8;

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
  /**
   * Embedded JPEG data URIs in display order (primary first).
   * Empty when the item has no readable local photos.
   */
  imageDataUris: string[];
};

export type PdfRoomSection = {
  roomName: string;
  items: ExportPdfItemBlock[];
};

/** One planned page inside a room (grid of regular items, or one multi-photo item). */
export type PdfRoomPage =
  | {
      kind: 'grid';
      items: ExportPdfItemBlock[];
    }
  | {
      kind: 'multiPhoto';
      item: ExportPdfItemBlock;
    };

/** One page in the finished house PDF, with global numbering metadata. */
export type PlannedHousePdfPage = {
  pageNumber: number;
  roomName: string;
  roomItemCount: number;
  isFirstPageOfDocument: boolean;
  isFirstPageOfRoom: boolean;
  page: PdfRoomPage;
};

/**
 * Counts photos that PDF export can actually embed (local files / data URIs).
 * Ignores photoCount alone — that can include Drive-only images with no local file.
 */
export function getPdfPhotoCount(item: ExportPdfItemBlock): number {
  if (item.imageDataUris.length > 0) {
    return item.imageDataUris.length;
  }

  if (item.localImagePaths.length > 0) {
    return item.localImagePaths.length;
  }

  return item.localImagePath !== null ? 1 : 0;
}

/**
 * Returns true when an item belongs on its own dedicated photo page.
 */
export function isMultiPhotoPdfItem(item: ExportPdfItemBlock): boolean {
  return getPdfPhotoCount(item) >= 2;
}

/**
 * Splits a list into fixed-size chunks (last chunk may be shorter).
 */
export function chunkItemsForPdfPages<T>(items: T[], pageSize: number): T[][] {
  if (pageSize <= 0) {
    return [items];
  }

  const pages: T[][] = [];

  for (let index = 0; index < items.length; index += pageSize) {
    pages.push(items.slice(index, index + pageSize));
  }

  return pages;
}

/**
 * Groups already room-sorted items into consecutive room sections.
 * Analogy: keeping kitchen cards in one pile and office cards in another.
 */
export function groupItemsByRoom(items: ExportPdfItemBlock[]): PdfRoomSection[] {
  const roomSections: PdfRoomSection[] = [];

  for (const item of items) {
    const lastSection = roomSections[roomSections.length - 1];

    if (lastSection !== undefined && lastSection.roomName === item.roomName) {
      lastSection.items.push(item);
      continue;
    }

    roomSections.push({
      roomName: item.roomName,
      items: [item],
    });
  }

  return roomSections;
}

/**
 * Sums purchase prices for the PDF house header.
 */
export function sumHousePurchaseValueUsd(items: ExportPdfItemBlock[]): number {
  let totalValueUsd = 0;

  for (const item of items) {
    totalValueUsd += item.purchasePriceUsd;
  }

  return totalValueUsd;
}

/**
 * Builds the house metadata line: date · item count · total value.
 */
export function buildHousePdfMetaLine(options: {
  generatedAtLabel: string;
  itemCount: number;
  totalValueUsd: number;
}): string {
  const itemLabel = options.itemCount === 1 ? '1 item' : `${options.itemCount} items`;

  return `Generated ${options.generatedAtLabel} · ${itemLabel} · $${options.totalValueUsd.toFixed(2)}`;
}

/**
 * Plans a room's pages: fill 2×2 grids with regular items, then flush queued multi-photos.
 * Example: A, M, B, C, D → grid(A,B,C,D) then multi(M).
 */
export function planRoomPages(items: ExportPdfItemBlock[]): PdfRoomPage[] {
  const pages: PdfRoomPage[] = [];
  const regularBuffer: ExportPdfItemBlock[] = [];
  const queuedMultiPhotoItems: ExportPdfItemBlock[] = [];

  /**
   * Emits a grid page from the front of the regular buffer, then queued multi-photos.
   */
  function flushFullGridThenQueuedMultiPhotos() {
    while (regularBuffer.length >= PDF_GRID_ITEMS_PER_PAGE) {
      const gridItems = regularBuffer.splice(0, PDF_GRID_ITEMS_PER_PAGE);
      pages.push({
        kind: 'grid',
        items: gridItems,
      });

      while (queuedMultiPhotoItems.length > 0) {
        const multiPhotoItem = queuedMultiPhotoItems.shift();

        if (multiPhotoItem === undefined) {
          break;
        }

        pages.push({
          kind: 'multiPhoto',
          item: multiPhotoItem,
        });
      }
    }
  }

  for (const item of items) {
    if (isMultiPhotoPdfItem(item)) {
      queuedMultiPhotoItems.push(item);
      continue;
    }

    regularBuffer.push(item);
    flushFullGridThenQueuedMultiPhotos();
  }

  // End of room: emit any leftover regular cards, then remaining multi-photo pages.
  if (regularBuffer.length > 0) {
    pages.push({
      kind: 'grid',
      items: [...regularBuffer],
    });
    regularBuffer.length = 0;
  }

  while (queuedMultiPhotoItems.length > 0) {
    const multiPhotoItem = queuedMultiPhotoItems.shift();

    if (multiPhotoItem === undefined) {
      break;
    }

    pages.push({
      kind: 'multiPhoto',
      item: multiPhotoItem,
    });
  }

  return pages;
}

/**
 * Builds one inventory card for the 2×2 grid (primary photo only).
 */
function buildGridItemCardHtml(item: ExportPdfItemBlock): string {
  const primaryImageDataUri = item.imageDataUris[0] ?? null;
  const imageHtml =
    primaryImageDataUri !== null
      ? `<img class="photo" src="${primaryImageDataUri}" alt="${escapeHtml(item.itemName)}" />`
      : `<div class="photo-missing">No photo</div>`;

  return `
      <section class="item-card" data-grid-item-name="${escapeHtml(item.itemName)}">
        ${imageHtml}
        <h2>${escapeHtml(item.itemName)}</h2>
        <p><strong>Brand:</strong> ${escapeHtml(item.brand.length > 0 ? item.brand : '—')}</p>
        <p><strong>Model:</strong> ${escapeHtml(item.model.length > 0 ? item.model : '—')}</p>
        <p><strong>Category:</strong> ${escapeHtml(
          item.categoryName.length > 0 ? item.categoryName : '—',
        )}</p>
        <p><strong>Purchase price:</strong> $${item.purchasePriceUsd.toFixed(2)}</p>
        <p><strong>Purchase date:</strong> ${escapeHtml(
          item.purchaseDate.length > 0 ? item.purchaseDate : '—',
        )}</p>
        <p><strong>Description:</strong> ${escapeHtml(
          item.description.length > 0 ? item.description : '—',
        )}</p>
      </section>`;
}

/**
 * Chooses a CSS photo-grid class so one dedicated page can fit N photos.
 */
function buildPhotoSheetGridClassName(photoCount: number): string {
  if (photoCount <= 2) {
    return 'photo-sheet-grid photo-sheet-grid--two';
  }

  if (photoCount <= 4) {
    return 'photo-sheet-grid photo-sheet-grid--four';
  }

  if (photoCount <= 6) {
    return 'photo-sheet-grid photo-sheet-grid--six';
  }

  return 'photo-sheet-grid photo-sheet-grid--many';
}

/**
 * Builds one dedicated landscape page for a multi-photo item.
 */
function buildMultiPhotoItemPageHtml(item: ExportPdfItemBlock): string {
  const photoCount = item.imageDataUris.length;
  const photoBlocks = item.imageDataUris
    .map((imageDataUri, imageIndex) => {
      return `
        <figure class="sheet-photo">
          <img src="${imageDataUri}" alt="${escapeHtml(item.itemName)} photo ${imageIndex + 1}" />
          <figcaption>Photo ${imageIndex + 1} of ${photoCount}</figcaption>
        </figure>`;
    })
    .join('\n');

  return `
    <section
      class="photo-sheet"
      data-multi-photo-sheet="true"
      data-item-photo-page="true"
      data-photo-item-name="${escapeHtml(item.itemName)}"
      data-photo-count="${photoCount}">
      <header class="photo-sheet-header">
        <h2>${escapeHtml(item.itemName)}</h2>
        <p>${escapeHtml(item.roomName)} · ${photoCount} photos</p>
      </header>
      <div class="photo-sheet-details" data-photo-item-details="true">
        <p><strong>Brand:</strong> ${escapeHtml(item.brand.length > 0 ? item.brand : '—')}</p>
        <p><strong>Model:</strong> ${escapeHtml(item.model.length > 0 ? item.model : '—')}</p>
        <p><strong>Category:</strong> ${escapeHtml(
          item.categoryName.length > 0 ? item.categoryName : '—',
        )}</p>
        <p><strong>Purchase price:</strong> $${item.purchasePriceUsd.toFixed(2)}</p>
        <p><strong>Purchase date:</strong> ${escapeHtml(
          item.purchaseDate.length > 0 ? item.purchaseDate : '—',
        )}</p>
        <p class="photo-sheet-description"><strong>Description:</strong> ${escapeHtml(
          item.description.length > 0 ? item.description : '—',
        )}</p>
      </div>
      <div class="${buildPhotoSheetGridClassName(photoCount)}">
        ${photoBlocks}
      </div>
    </section>`;
}

/**
 * Builds the repeated footer for one explicitly planned PDF page.
 */
function buildPdfPageFooterHtml(options: {
  houseName: string;
  roomName?: string;
  pageNumber: number;
  totalPageCount: number;
}): string {
  const locationLabel =
    options.roomName === undefined
      ? escapeHtml(options.houseName)
      : `${escapeHtml(options.houseName)} - ${escapeHtml(options.roomName)}`;

  return `<footer class="pdf-page-footer" data-pdf-page-footer="true">
        <span>${locationLabel}</span>
        <span>Page ${options.pageNumber} of ${options.totalPageCount}</span>
      </footer>`;
}

/**
 * Flattens room-sorted items into a globally numbered page list (no Base64 required).
 */
export function planHousePdfDocument(
  items: ExportPdfItemBlock[],
): PlannedHousePdfPage[] {
  if (items.length === 0) {
    return [];
  }

  const roomSections = groupItemsByRoom(items);
  const plannedPages: PlannedHousePdfPage[] = [];
  let pageNumber = 1;

  for (const roomSection of roomSections) {
    const roomPages = planRoomPages(roomSection.items);

    for (let pageIndex = 0; pageIndex < roomPages.length; pageIndex += 1) {
      plannedPages.push({
        pageNumber,
        roomName: roomSection.roomName,
        roomItemCount: roomSection.items.length,
        isFirstPageOfDocument: pageNumber === 1,
        isFirstPageOfRoom: pageIndex === 0,
        page: roomPages[pageIndex],
      });
      pageNumber += 1;
    }
  }

  return plannedPages;
}

/**
 * Splits planned pages into print batches (default 8 pages each).
 */
export function chunkPlannedPdfPages(
  plannedPages: PlannedHousePdfPage[],
  maxPagesPerChunk: number = PDF_PRINT_CHUNK_MAX_PAGES,
): PlannedHousePdfPage[][] {
  return chunkItemsForPdfPages(plannedPages, maxPagesPerChunk);
}

/**
 * Renders one planned page (grid or multi-photo) with headers/footer.
 */
function buildOnePlannedPageHtml(options: {
  plannedPage: PlannedHousePdfPage;
  houseName: string;
  houseMetaLine: string;
  totalPageCount: number;
  isFirstHtmlPage: boolean;
}): string {
  const {
    plannedPage,
    houseName,
    houseMetaLine,
    totalPageCount,
    isFirstHtmlPage,
  } = options;

  // Only later pages in this HTML document need a forced page break.
  const pageBreakStyle = isFirstHtmlPage
    ? ''
    : ' style="page-break-before: always;"';

  const roomHeaderHtml = plannedPage.isFirstPageOfRoom
    ? `<header class="room-header" data-room-section="true">
        <h2>${escapeHtml(plannedPage.roomName)}</h2>
        <p class="room-meta">${plannedPage.roomItemCount} item(s)</p>
      </header>`
    : '';

  const houseHeaderHtml = plannedPage.isFirstPageOfDocument
    ? `<header class="doc-header">
        <h1>${escapeHtml(houseName)} — Home Inventory</h1>
        <p class="meta">${escapeHtml(houseMetaLine)}</p>
      </header>`
    : '';

  const pageFooterHtml = buildPdfPageFooterHtml({
    houseName,
    roomName: plannedPage.roomName,
    pageNumber: plannedPage.pageNumber,
    totalPageCount,
  });

  if (plannedPage.page.kind === 'grid') {
    const cardsHtml = plannedPage.page.items.map(buildGridItemCardHtml).join('\n');

    return `
    <section
      class="pdf-page grid-page"
      data-pdf-page-number="${plannedPage.pageNumber}"
      data-pdf-grid-page="true"
      data-room-name="${escapeHtml(plannedPage.roomName)}"${pageBreakStyle}>
      ${houseHeaderHtml}
      ${roomHeaderHtml}
      <div class="item-grid">
        ${cardsHtml}
      </div>
      ${pageFooterHtml}
    </section>`;
  }

  return `
    <div
      class="pdf-page photo-sheet-break"
      data-pdf-page-number="${plannedPage.pageNumber}"${pageBreakStyle}>
      ${houseHeaderHtml}
      ${roomHeaderHtml}
      ${buildMultiPhotoItemPageHtml(plannedPage.page.item)}
      ${pageFooterHtml}
    </div>`;
}

/**
 * Builds body HTML for a slice of planned pages (one print chunk).
 * Page numbers stay global; house header only on document page 1.
 */
export function buildInventoryPdfHtmlForPlannedPages(options: {
  houseName: string;
  houseMetaLine: string;
  plannedPages: PlannedHousePdfPage[];
  totalPageCount: number;
}): string {
  const { houseName, houseMetaLine, plannedPages, totalPageCount } = options;

  if (plannedPages.length === 0) {
    return '';
  }

  // Wrap consecutive pages of the same room so existing tests/structure stay intact.
  const roomGroups: PlannedHousePdfPage[][] = [];

  for (const plannedPage of plannedPages) {
    const lastGroup = roomGroups[roomGroups.length - 1];

    if (
      lastGroup !== undefined &&
      lastGroup[0].roomName === plannedPage.roomName
    ) {
      lastGroup.push(plannedPage);
      continue;
    }

    roomGroups.push([plannedPage]);
  }

  let htmlPageIndex = 0;

  const roomSectionsHtml = roomGroups
    .map((roomGroup) => {
      const pagesHtml = roomGroup
        .map((plannedPage) => {
          const isFirstHtmlPage = htmlPageIndex === 0;
          htmlPageIndex += 1;

          return buildOnePlannedPageHtml({
            plannedPage,
            houseName,
            houseMetaLine,
            totalPageCount,
            isFirstHtmlPage,
          });
        })
        .join('\n');

      return `
    <section class="room-section" data-pdf-room-section="true">
      ${pagesHtml}
    </section>`;
    })
    .join('\n');

  return roomSectionsHtml;
}

/**
 * Wraps body HTML in the shared landscape Letter document shell.
 */
function wrapInventoryPdfDocumentHtml(
  houseName: string,
  bodyHtml: string,
): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(houseName)} Inventory</title>
    <style>
      @page {
        size: ${PDF_LANDSCAPE_LETTER_WIDTH}pt ${PDF_LANDSCAPE_LETTER_HEIGHT}pt;
        margin: 24pt;
      }
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #111827;
        margin: 0;
        padding: 0;
        line-height: 1.35;
      }
      h1 { font-size: 18px; margin: 0 0 2px; }
      .meta { color: #6b7280; margin: 0 0 6px; font-size: 11px; }
      .doc-header { margin-bottom: 4px; }
      .pdf-page {
        box-sizing: border-box;
        page-break-inside: avoid;
      }
      .pdf-page-footer {
        display: flex;
        justify-content: space-between;
        margin-top: 6px;
        padding-top: 2px;
        border-top: 1px solid #e5e7eb;
        color: #6b7280;
        font-size: 9px;
        line-height: 1.2;
      }
      .room-header h2 {
        font-size: 15px;
        margin: 0 0 1px;
      }
      .room-meta {
        color: #6b7280;
        margin: 0 0 6px;
        font-size: 11px;
      }
      .grid-page {
        page-break-inside: avoid;
      }
      .item-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .item-card {
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 10px;
        page-break-inside: avoid;
        break-inside: avoid;
        min-height: 0;
      }
      .item-card h2 { font-size: 14px; margin: 8px 0 4px; }
      .item-card p { margin: 2px 0; font-size: 11px; }
      .item-card .photo {
        width: 100%;
        max-height: 120px;
        object-fit: contain;
        background: #f3f4f6;
        border-radius: 6px;
      }
      .photo-missing {
        height: 80px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f3f4f6;
        color: #6b7280;
        border-radius: 6px;
        font-size: 12px;
      }
      .photo-sheet {
        page-break-inside: avoid;
      }
      .photo-sheet-header h2 { font-size: 18px; margin: 0 0 4px; }
      .photo-sheet-header p { color: #6b7280; margin: 0 0 6px; font-size: 12px; }
      .photo-sheet-details {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 2px 12px;
        margin-bottom: 8px;
      }
      .photo-sheet-details p {
        margin: 0;
        font-size: 10px;
      }
      .photo-sheet-description {
        grid-column: 1 / -1;
      }
      .photo-sheet-grid {
        display: grid;
        gap: 10px;
      }
      .photo-sheet-grid--two {
        grid-template-columns: 1fr 1fr;
      }
      .photo-sheet-grid--four {
        grid-template-columns: 1fr 1fr;
      }
      .photo-sheet-grid--six {
        grid-template-columns: 1fr 1fr 1fr;
      }
      .photo-sheet-grid--many {
        grid-template-columns: 1fr 1fr 1fr 1fr;
      }
      .sheet-photo {
        margin: 0;
        page-break-inside: avoid;
        break-inside: avoid;
      }
      .photo-sheet-grid--two .sheet-photo img {
        max-height: 300px;
      }
      .photo-sheet-grid--four .sheet-photo img {
        max-height: 180px;
      }
      .photo-sheet-grid--six .sheet-photo img {
        max-height: 130px;
      }
      .photo-sheet-grid--many .sheet-photo img {
        max-height: 95px;
      }
      .sheet-photo img {
        width: 100%;
        object-fit: contain;
        background: #f3f4f6;
        border-radius: 6px;
      }
      .sheet-photo figcaption {
        font-size: 11px;
        color: #6b7280;
        margin-top: 4px;
      }
      .empty { color: #6b7280; }
    </style>
  </head>
  <body data-pdf-orientation="landscape-letter">
    ${bodyHtml}
  </body>
</html>`;
}

/**
 * Builds landscape Letter HTML: house title/totals, room sections with interleaved
 * 2×2 grids and dedicated multi-photo pages.
 */
export function buildInventoryPdfHtml(options: {
  houseName: string;
  generatedAtLabel: string;
  items: ExportPdfItemBlock[];
}): string {
  const { houseName, generatedAtLabel, items } = options;
  const totalValueUsd = sumHousePurchaseValueUsd(items);
  const houseMetaLine = buildHousePdfMetaLine({
    generatedAtLabel,
    itemCount: items.length,
    totalValueUsd,
  });

  if (items.length === 0) {
    const emptyMessage = `<section class="pdf-page" data-pdf-page-number="1">
      <header class="doc-header">
        <h1>${escapeHtml(houseName)} — Home Inventory</h1>
        <p class="meta">${escapeHtml(
          buildHousePdfMetaLine({
            generatedAtLabel,
            itemCount: 0,
            totalValueUsd: 0,
          }),
        )}</p>
      </header>
      <p class="empty">No items in this house yet.</p>
      ${buildPdfPageFooterHtml({
        houseName,
        pageNumber: 1,
        totalPageCount: 1,
      })}
    </section>`;

    return wrapInventoryPdfDocumentHtml(houseName, emptyMessage);
  }

  const plannedPages = planHousePdfDocument(items);
  const roomSectionsHtml = buildInventoryPdfHtmlForPlannedPages({
    houseName,
    houseMetaLine,
    plannedPages,
    totalPageCount: plannedPages.length,
  });

  return wrapInventoryPdfDocumentHtml(houseName, roomSectionsHtml);
}

/**
 * Builds a full HTML document for one print chunk (subset of planned pages).
 */
export function buildInventoryPdfChunkHtml(options: {
  houseName: string;
  generatedAtLabel: string;
  allItemsForMeta: ExportPdfItemBlock[];
  plannedPagesChunk: PlannedHousePdfPage[];
  totalPageCount: number;
}): string {
  const {
    houseName,
    generatedAtLabel,
    allItemsForMeta,
    plannedPagesChunk,
    totalPageCount,
  } = options;

  const houseMetaLine = buildHousePdfMetaLine({
    generatedAtLabel,
    itemCount: allItemsForMeta.length,
    totalValueUsd: sumHousePurchaseValueUsd(allItemsForMeta),
  });

  const bodyHtml = buildInventoryPdfHtmlForPlannedPages({
    houseName,
    houseMetaLine,
    plannedPages: plannedPagesChunk,
    totalPageCount,
  });

  return wrapInventoryPdfDocumentHtml(houseName, bodyHtml);
}
