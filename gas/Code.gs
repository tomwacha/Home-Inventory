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
  'model',
  'category',
  'purchase_price_usd',
  'purchase_date',
  'description',
  'Primary Photo',
  'Additional Photo 1',
  'Additional Photo 2',
  'Additional Photo 3',
  'Additional Photo 4',
  'item_images_json',
  'updated_at',
  'client_item_id',
];

var COL = {
  sheetRowId: 1,
  houseName: 2,
  roomName: 3,
  itemName: 4,
  brand: 5,
  model: 6,
  category: 7,
  purchasePriceUsd: 8,
  purchaseDate: 9,
  description: 10,
  driveImageUrl: 11,
  additionalPhoto1: 12,
  additionalPhoto2: 13,
  additionalPhoto3: 14,
  additionalPhoto4: 15,
  itemImagesJson: 16,
  updatedAt: 17,
  clientItemId: 18,
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
      model: String(valueRow[COL.model - 1] || ''),
      categoryName: String(valueRow[COL.category - 1] || ''),
      purchasePriceUsd: Number(valueRow[COL.purchasePriceUsd - 1] || 0),
      purchaseDate: valueRow[COL.purchaseDate - 1] === '' || valueRow[COL.purchaseDate - 1] === null
        ? null
        : String(valueRow[COL.purchaseDate - 1]),
      description: String(valueRow[COL.description - 1] || ''),
      driveImageUrl: String(valueRow[COL.driveImageUrl - 1] || '') || null,
      additionalPhotoUrls: [
        String(valueRow[COL.additionalPhoto1 - 1] || ''),
        String(valueRow[COL.additionalPhoto2 - 1] || ''),
        String(valueRow[COL.additionalPhoto3 - 1] || ''),
        String(valueRow[COL.additionalPhoto4 - 1] || ''),
      ],
      itemImagesJson: String(valueRow[COL.itemImagesJson - 1] || ''),
      updatedAt: String(valueRow[COL.updatedAt - 1] || ''),
      clientItemId: valueRow[COL.clientItemId - 1] === '' || valueRow[COL.clientItemId - 1] === null
        ? null
        : Number(valueRow[COL.clientItemId - 1]),
    });
  }

  return rows;
}

/**
 * Parses the Sheet JSON cell into an ordered images metadata array.
 */
function parseItemImagesJson(rawJsonText) {
  if (!rawJsonText || String(rawJsonText).trim().length === 0) {
    return [];
  }

  try {
    var parsed = JSON.parse(String(rawJsonText));
    if (!parsed || !parsed.length) {
      return [];
    }
    return parsed;
  } catch (error) {
    return [];
  }
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
function uploadImageToDrive(folderId, itemName, imageBase64, imageMimeType, fileLabel) {
  if (!imageBase64) {
    return null;
  }

  var folder = DriveApp.getFolderById(folderId);
  var safeName = String(fileLabel || itemName || 'item').replace(/[\\/:*?"<>|]/g, '-');
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
 * Uploads every photo on an item; keeps primary URL for the classic column.
 */
function uploadItemImages(item, folderId, matchedImagesJson) {
  var existingMetadata = parseItemImagesJson(matchedImagesJson);
  var existingByImageId = {};
  var existingIndex;
  var imageIndex;
  var uploadedImages = [];
  var primaryDriveUrl = null;
  var incomingImages = item.images && item.images.length ? item.images : null;

  for (existingIndex = 0; existingIndex < existingMetadata.length; existingIndex++) {
    var existingMeta = existingMetadata[existingIndex];
    if (existingMeta && existingMeta.imageId != null) {
      existingByImageId[String(existingMeta.imageId)] = existingMeta;
    }
  }

  // Older clients only send singular imageBase64 — wrap as one primary photo.
  if (!incomingImages) {
    incomingImages = [];
    if (item.imageBase64) {
      incomingImages.push({
        imageId: null,
        imageNumber: 1,
        sortOrder: 0,
        isPrimary: true,
        imageBase64: item.imageBase64,
        imageMimeType: item.imageMimeType || 'image/jpeg',
        driveImageUrl: null,
      });
    } else if (existingMetadata.length > 0) {
      return {
        driveImageUrl: existingMetadata[0].driveImageUrl || null,
        images: existingMetadata,
        imagesJson: JSON.stringify(existingMetadata),
      };
    }
  }

  for (imageIndex = 0; imageIndex < incomingImages.length; imageIndex++) {
    var imagePayload = incomingImages[imageIndex];
    var driveImageUrl = imagePayload.driveImageUrl || null;
    var prior =
      imagePayload.imageId != null
        ? existingByImageId[String(imagePayload.imageId)]
        : null;

    if (!driveImageUrl && prior && prior.driveImageUrl) {
      driveImageUrl = prior.driveImageUrl;
    }

    if (imagePayload.imageBase64) {
      if (!folderId) {
        throw new Error(
          'No Drive folder id. Pass driveFolderId in the request or set Script Property DRIVE_FOLDER_ID.'
        );
      }

      driveImageUrl = uploadImageToDrive(
        folderId,
        item.name,
        imagePayload.imageBase64,
        imagePayload.imageMimeType || 'image/jpeg',
        item.name + '-' + (imagePayload.imageNumber || imageIndex + 1)
      );
    }

    var metadata = {
      imageId: imagePayload.imageId != null ? imagePayload.imageId : null,
      imageNumber: imagePayload.imageNumber != null ? imagePayload.imageNumber : imageIndex + 1,
      sortOrder: imagePayload.sortOrder != null ? imagePayload.sortOrder : imageIndex,
      isPrimary: !!imagePayload.isPrimary,
      driveImageUrl: driveImageUrl,
    };

    uploadedImages.push(metadata);

    if (metadata.isPrimary) {
      primaryDriveUrl = driveImageUrl;
    }
  }

  if (primaryDriveUrl === null && uploadedImages.length > 0) {
    primaryDriveUrl = uploadedImages[0].driveImageUrl || null;
    uploadedImages[0].isPrimary = true;
  }

  return {
    driveImageUrl: primaryDriveUrl,
    images: uploadedImages,
    imagesJson: JSON.stringify(uploadedImages),
  };
}

/**
 * Builds the five human-readable Sheet photo columns (primary + four additional).
 * Complete metadata still remains in item_images_json for photos beyond five.
 */
function buildSheetPhotoColumns(uploadImageResult) {
  var photoColumns = [
    uploadImageResult.driveImageUrl || '',
    '',
    '',
    '',
    '',
  ];
  var additionalColumnIndex = 1;
  var imageIndex;

  for (imageIndex = 0; imageIndex < uploadImageResult.images.length; imageIndex++) {
    var image = uploadImageResult.images[imageIndex];

    if (image.isPrimary) {
      continue;
    }

    if (additionalColumnIndex >= photoColumns.length) {
      break;
    }

    photoColumns[additionalColumnIndex] = image.driveImageUrl || '';
    additionalColumnIndex += 1;
  }

  return photoColumns;
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

  // Resolve Drive folder if any item has Base64 (singular or images[]).
  var needsDrive = false;
  for (index = 0; index < items.length; index++) {
    var candidate = items[index];
    if (candidate.imageBase64) {
      needsDrive = true;
      break;
    }
    if (candidate.images && candidate.images.length) {
      var imageCheckIndex;
      for (imageCheckIndex = 0; imageCheckIndex < candidate.images.length; imageCheckIndex++) {
        if (candidate.images[imageCheckIndex].imageBase64) {
          needsDrive = true;
          break;
        }
      }
      if (needsDrive) {
        break;
      }
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
        images: parseItemImagesJson(matched.itemImagesJson),
        status: 'skipped',
      });
      continue;
    }

    var sheetRowId = matched && matched.sheetRowId
      ? matched.sheetRowId
      : item.sheetRowId || createSheetRowId();

    var uploadImageResult = uploadItemImages(
      item,
      folderId,
      matched ? matched.itemImagesJson : ''
    );
    var sheetPhotoColumns = buildSheetPhotoColumns(uploadImageResult);

    var rowValues = [
      sheetRowId,
      item.houseName || '',
      item.roomName || '',
      item.name || '',
      item.brand || '',
      item.model || '',
      item.categoryName || '',
      item.purchasePriceUsd != null ? item.purchasePriceUsd : 0,
      item.purchaseDate != null ? item.purchaseDate : '',
      item.description || '',
      sheetPhotoColumns[0],
      sheetPhotoColumns[1],
      sheetPhotoColumns[2],
      sheetPhotoColumns[3],
      sheetPhotoColumns[4],
      uploadImageResult.imagesJson || '[]',
      item.updatedAt || new Date().toISOString(),
      item.clientItemId != null ? item.clientItemId : '',
    ];

    if (matched) {
      sheet.getRange(matched.sheetRowNumber, 1, 1, HEADER_ROW.length).setValues([rowValues]);
      results.push({
        clientItemId: item.clientItemId,
        sheetRowId: sheetRowId,
        driveImageUrl: uploadImageResult.driveImageUrl,
        images: uploadImageResult.images,
        status: 'updated',
      });
    } else {
      sheet.appendRow(rowValues);
      results.push({
        clientItemId: item.clientItemId,
        sheetRowId: sheetRowId,
        driveImageUrl: uploadImageResult.driveImageUrl,
        images: uploadImageResult.images,
        status: 'created',
      });
    }

    // Register this write so a later item in the same upload cannot collide on name.
    var writtenRow = {
      sheetRowNumber: matched ? matched.sheetRowNumber : sheet.getLastRow(),
      sheetRowId: sheetRowId,
      houseName: String(item.houseName || ''),
      roomName: String(item.roomName || ''),
      name: String(item.name || ''),
      driveImageUrl: uploadImageResult.driveImageUrl || null,
      itemImagesJson: uploadImageResult.imagesJson || '[]',
    };
    bySheetRowId[sheetRowId] = writtenRow;
    byMatchKey[buildMatchKey(writtenRow.houseName, writtenRow.roomName, writtenRow.name)] =
      writtenRow;
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

    var images = parseItemImagesJson(row.itemImagesJson);

    // Rebuild metadata from the five visible photo columns when JSON is absent.
    if (images.length === 0) {
      var visiblePhotoUrls = [row.driveImageUrl];
      var additionalPhotoIndex;

      for (
        additionalPhotoIndex = 0;
        additionalPhotoIndex < row.additionalPhotoUrls.length;
        additionalPhotoIndex++
      ) {
        visiblePhotoUrls.push(row.additionalPhotoUrls[additionalPhotoIndex]);
      }

      var visiblePhotoIndex;
      for (visiblePhotoIndex = 0; visiblePhotoIndex < visiblePhotoUrls.length; visiblePhotoIndex++) {
        var visiblePhotoUrl = visiblePhotoUrls[visiblePhotoIndex];

        if (!visiblePhotoUrl) {
          continue;
        }

        images.push({
          imageId: null,
          imageNumber: images.length + 1,
          sortOrder: images.length,
          isPrimary: images.length === 0,
          driveImageUrl: visiblePhotoUrl,
        });
      }
    }

    items.push({
      sheetRowId: row.sheetRowId,
      houseName: row.houseName,
      roomName: row.roomName,
      name: row.name,
      brand: row.brand,
      model: row.model,
      categoryName: row.categoryName,
      purchasePriceUsd: row.purchasePriceUsd,
      purchaseDate: row.purchaseDate,
      description: row.description,
      driveImageUrl: row.driveImageUrl,
      images: images,
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
