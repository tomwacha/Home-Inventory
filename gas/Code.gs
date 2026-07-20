/**
 * Home Inventory — Google Apps Script Web App gateway (Milestone 3).
 *
 * Bind this script to a Google Sheet, set Script Properties, deploy as Web App.
 * See gas/README.md for step-by-step deploy instructions.
 *
 * Analogy: a receptionist for your spreadsheet — the phone knocks (HTTP),
 * this script files photos in Drive and writes/reads rows in the Sheet.
 */

// ---- Sheet column layout (row 1 = headers) ----
var HEADER_ROW = [
  'sheet_row_id',
  'house_name',
  'room_name',
  'item_name',
  'brand',
  'category',
  'purchase_price_usd',
  'purchase_year',
  'description',
  'drive_image_url',
  'updated_at',
  'client_item_id',
];

var COL = {
  sheetRowId: 1,
  houseName: 2,
  roomName: 3,
  itemName: 4,
  brand: 5,
  category: 6,
  purchasePriceUsd: 7,
  purchaseYear: 8,
  description: 9,
  driveImageUrl: 10,
  updatedAt: 11,
  clientItemId: 12,
};

/**
 * GET handler: ping or download inventory rows.
 * Examples:
 *   ?action=ping
 *   ?action=download
 *   ?action=download&houseName=Beach%20House
 */
function doGet(event) {
  try {
    var params = event && event.parameter ? event.parameter : {};
    var action = params.action || 'ping';

    if (action === 'ping') {
      return jsonOutput({
        ok: true,
        action: 'ping',
        message: 'Home Inventory GAS gateway is reachable.',
      });
    }

    if (action === 'download') {
      var houseFilter = params.houseName || null;
      return jsonOutput(downloadItems(houseFilter));
    }

    return jsonOutput({
      ok: false,
      error: 'Unknown GET action. Use action=ping or action=download.',
    });
  } catch (error) {
    return jsonOutput({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

/**
 * POST handler: checkDuplicates or upload.
 * Body must be JSON (text/plain or application/json).
 */
function doPost(event) {
  try {
    var rawBody = event && event.postData && event.postData.contents
      ? event.postData.contents
      : '{}';
    var body = JSON.parse(rawBody);
    var action = body.action;

    if (action === 'checkDuplicates') {
      return jsonOutput(checkDuplicates(body.items || []));
    }

    if (action === 'upload') {
      return jsonOutput(
        uploadItems(body.items || [], body.duplicateMode || 'skip', body.driveFolderId || null)
      );
    }

    return jsonOutput({
      ok: false,
      error: 'Unknown POST action. Use action=checkDuplicates or action=upload.',
    });
  } catch (error) {
    return jsonOutput({
      ok: false,
      error: String(error && error.message ? error.message : error),
    });
  }
}

/**
 * Ensures the active sheet has header row 1 in the expected order.
 */
function ensureHeaderRow(sheet) {
  var lastColumn = HEADER_ROW.length;
  var existingHeaders = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var needsHeader = false;
  var index;

  for (index = 0; index < HEADER_ROW.length; index++) {
    if (String(existingHeaders[index] || '') !== HEADER_ROW[index]) {
      needsHeader = true;
      break;
    }
  }

  if (needsHeader) {
    sheet.getRange(1, 1, 1, lastColumn).setValues([HEADER_ROW]);
  }
}

/**
 * Returns the inventory sheet (first sheet in the bound spreadsheet).
 */
function getInventorySheet() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = spreadsheet.getSheets()[0];
  ensureHeaderRow(sheet);
  return sheet;
}

/**
 * Reads all data rows (skips header) as objects.
 */
function readAllSheetRows(sheet) {
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    return [];
  }

  var numDataRows = lastRow - 1;
  var values = sheet.getRange(2, 1, numDataRows, HEADER_ROW.length).getValues();
  var rows = [];
  var rowIndex;

  for (rowIndex = 0; rowIndex < values.length; rowIndex++) {
    var valueRow = values[rowIndex];
    var sheetRowNumber = rowIndex + 2;
    var sheetRowId = String(valueRow[COL.sheetRowId - 1] || '');

    // Skip completely empty trailing rows.
    if (!sheetRowId && !String(valueRow[COL.itemName - 1] || '')) {
      continue;
    }

    rows.push({
      sheetRowNumber: sheetRowNumber,
      sheetRowId: sheetRowId,
      houseName: String(valueRow[COL.houseName - 1] || ''),
      roomName: String(valueRow[COL.roomName - 1] || ''),
      name: String(valueRow[COL.itemName - 1] || ''),
      brand: String(valueRow[COL.brand - 1] || ''),
      categoryName: String(valueRow[COL.category - 1] || ''),
      purchasePriceUsd: Number(valueRow[COL.purchasePriceUsd - 1] || 0),
      purchaseYear: valueRow[COL.purchaseYear - 1] === '' || valueRow[COL.purchaseYear - 1] === null
        ? null
        : Number(valueRow[COL.purchaseYear - 1]),
      description: String(valueRow[COL.description - 1] || ''),
      driveImageUrl: String(valueRow[COL.driveImageUrl - 1] || '') || null,
      updatedAt: String(valueRow[COL.updatedAt - 1] || ''),
      clientItemId: valueRow[COL.clientItemId - 1] === '' || valueRow[COL.clientItemId - 1] === null
        ? null
        : Number(valueRow[COL.clientItemId - 1]),
    });
  }

  return rows;
}

/**
 * Builds a lookup key for duplicate detection: house|room|item (case-insensitive).
 */
function buildMatchKey(houseName, roomName, itemName) {
  return [
    String(houseName || '').trim().toLowerCase(),
    String(roomName || '').trim().toLowerCase(),
    String(itemName || '').trim().toLowerCase(),
  ].join('|');
}

/**
 * Finds which incoming items already exist in the Sheet.
 */
function checkDuplicates(items) {
  var sheet = getInventorySheet();
  var existingRows = readAllSheetRows(sheet);
  var bySheetRowId = {};
  var byMatchKey = {};
  var index;
  var duplicates = [];

  for (index = 0; index < existingRows.length; index++) {
    var existing = existingRows[index];

    if (existing.sheetRowId) {
      bySheetRowId[existing.sheetRowId] = existing;
    }

    byMatchKey[buildMatchKey(existing.houseName, existing.roomName, existing.name)] = existing;
  }

  for (index = 0; index < items.length; index++) {
    var item = items[index];
    var matched = null;

    if (item.sheetRowId && bySheetRowId[item.sheetRowId]) {
      matched = bySheetRowId[item.sheetRowId];
    } else {
      matched = byMatchKey[buildMatchKey(item.houseName, item.roomName, item.name)] || null;
    }

    if (matched) {
      duplicates.push({
        clientItemId: item.clientItemId,
        sheetRowId: matched.sheetRowId,
        houseName: matched.houseName,
        roomName: matched.roomName,
        name: matched.name,
        sheetRowNumber: matched.sheetRowNumber,
      });
    }
  }

  return {
    ok: true,
    action: 'checkDuplicates',
    duplicates: duplicates,
  };
}

/**
 * Resolves the Drive folder id from the request or Script Properties.
 */
function resolveDriveFolderId(requestFolderId) {
  if (requestFolderId) {
    return String(requestFolderId);
  }

  var fromProperties = PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');

  if (fromProperties) {
    return fromProperties;
  }

  throw new Error(
    'No Drive folder id. Pass driveFolderId in the request or set Script Property DRIVE_FOLDER_ID.'
  );
}

/**
 * Uploads a Base64 image into Drive and returns a viewable URL.
 */
function uploadImageToDrive(folderId, itemName, imageBase64, imageMimeType) {
  if (!imageBase64) {
    return null;
  }

  var folder = DriveApp.getFolderById(folderId);
  var safeName = String(itemName || 'item').replace(/[\\/:*?"<>|]/g, '-');
  var fileName = safeName + '-' + new Date().getTime() + '.jpg';
  var blob = Utilities.newBlob(
    Utilities.base64Decode(imageBase64),
    imageMimeType || 'image/jpeg',
    fileName
  );
  var file = folder.createFile(blob);

  // Anyone with the link can view — enough for the phone to load thumbnails later.
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return file.getUrl();
}

/**
 * Creates a new UUID-like sheet_row_id.
 */
function createSheetRowId() {
  return Utilities.getUuid();
}

/**
 * Writes or updates Sheet rows for each item.
 * duplicateMode:
 *   - skip: leave existing matches unchanged
 *   - override: replace matched rows (same sheet_row_id when known)
 */
function uploadItems(items, duplicateMode, driveFolderId) {
  var sheet = getInventorySheet();
  var existingRows = readAllSheetRows(sheet);
  var bySheetRowId = {};
  var byMatchKey = {};
  var index;
  var results = [];
  var folderId = null;

  // Only resolve Drive folder if at least one item has an image.
  var needsDrive = false;
  for (index = 0; index < items.length; index++) {
    if (items[index].imageBase64) {
      needsDrive = true;
      break;
    }
  }

  if (needsDrive) {
    folderId = resolveDriveFolderId(driveFolderId);
  }

  for (index = 0; index < existingRows.length; index++) {
    var existing = existingRows[index];

    if (existing.sheetRowId) {
      bySheetRowId[existing.sheetRowId] = existing;
    }

    byMatchKey[buildMatchKey(existing.houseName, existing.roomName, existing.name)] = existing;
  }

  for (index = 0; index < items.length; index++) {
    var item = items[index];
    var matched = null;

    if (item.sheetRowId && bySheetRowId[item.sheetRowId]) {
      matched = bySheetRowId[item.sheetRowId];
    } else {
      matched = byMatchKey[buildMatchKey(item.houseName, item.roomName, item.name)] || null;
    }

    if (matched && duplicateMode === 'skip') {
      results.push({
        clientItemId: item.clientItemId,
        sheetRowId: matched.sheetRowId,
        driveImageUrl: matched.driveImageUrl,
        status: 'skipped',
      });
      continue;
    }

    var sheetRowId = matched && matched.sheetRowId
      ? matched.sheetRowId
      : item.sheetRowId || createSheetRowId();

    var driveImageUrl = matched ? matched.driveImageUrl : null;

    if (item.imageBase64) {
      driveImageUrl = uploadImageToDrive(
        folderId,
        item.name,
        item.imageBase64,
        item.imageMimeType || 'image/jpeg'
      );
    }

    var rowValues = [
      sheetRowId,
      item.houseName || '',
      item.roomName || '',
      item.name || '',
      item.brand || '',
      item.categoryName || '',
      item.purchasePriceUsd != null ? item.purchasePriceUsd : 0,
      item.purchaseYear != null ? item.purchaseYear : '',
      item.description || '',
      driveImageUrl || '',
      item.updatedAt || new Date().toISOString(),
      item.clientItemId != null ? item.clientItemId : '',
    ];

    if (matched) {
      sheet.getRange(matched.sheetRowNumber, 1, 1, HEADER_ROW.length).setValues([rowValues]);
      results.push({
        clientItemId: item.clientItemId,
        sheetRowId: sheetRowId,
        driveImageUrl: driveImageUrl,
        status: 'updated',
      });
    } else {
      sheet.appendRow(rowValues);
      results.push({
        clientItemId: item.clientItemId,
        sheetRowId: sheetRowId,
        driveImageUrl: driveImageUrl,
        status: 'created',
      });
    }
  }

  return {
    ok: true,
    action: 'upload',
    results: results,
  };
}

/**
 * Returns Sheet rows as JSON for the phone (optional houseName filter).
 */
function downloadItems(houseNameFilter) {
  var sheet = getInventorySheet();
  var existingRows = readAllSheetRows(sheet);
  var items = [];
  var index;
  var filter = houseNameFilter ? String(houseNameFilter).trim().toLowerCase() : null;

  for (index = 0; index < existingRows.length; index++) {
    var row = existingRows[index];

    if (filter && String(row.houseName).trim().toLowerCase() !== filter) {
      continue;
    }

    items.push({
      sheetRowId: row.sheetRowId,
      houseName: row.houseName,
      roomName: row.roomName,
      name: row.name,
      brand: row.brand,
      categoryName: row.categoryName,
      purchasePriceUsd: row.purchasePriceUsd,
      purchaseYear: row.purchaseYear,
      description: row.description,
      driveImageUrl: row.driveImageUrl,
      updatedAt: row.updatedAt,
    });
  }

  return {
    ok: true,
    action: 'download',
    items: items,
  };
}

/**
 * Wraps a JS object as a JSON text HTTP response.
 */
function jsonOutput(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
