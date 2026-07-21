import type { SQLiteDatabase } from 'expo-sqlite';

import {
  createItemImage,
  deleteItemImage,
  getImagesByItemId,
  syncItemPrimaryImageColumns,
  updateItemImageFlags,
  updateItemImagePaths,
} from '@/db/itemImages';
import { deleteLocalImageIfExists } from '@/lib/images';
import {
  buildFinalItemImageFileName,
  renameLocalItemImageFile,
} from '@/lib/itemImageFiles';

/**
 * In-memory photo while editing Add/Edit Item (before or after a DB row exists).
 */
export type DraftItemPhoto = {
  /** Stable React list key (not the SQLite id). */
  clientKey: string;
  /** Existing item_images.id when this photo is already saved. */
  imageId: number | null;
  localPath: string;
  driveImageUrl: string | null;
  isPrimary: boolean;
  /** True when the file still uses a staged name and needs rename after insert. */
  needsFinalize: boolean;
};

/**
 * Builds a draft photo from a freshly picked local path (becomes primary if first).
 */
export function appendDraftItemPhoto(
  existingDrafts: DraftItemPhoto[],
  localPath: string,
): DraftItemPhoto[] {
  const nextDraft: DraftItemPhoto = {
    clientKey: `draft-${Date.now()}-${existingDrafts.length}`,
    imageId: null,
    localPath,
    driveImageUrl: null,
    isPrimary: existingDrafts.length === 0,
    needsFinalize: true,
  };

  return [...existingDrafts, nextDraft];
}

/**
 * Marks one draft as primary and clears the flag on the others.
 */
export function setDraftItemPhotoPrimary(
  drafts: DraftItemPhoto[],
  clientKey: string,
): DraftItemPhoto[] {
  return drafts.map((draft) => ({
    ...draft,
    isPrimary: draft.clientKey === clientKey,
  }));
}

/**
 * Replaces the local file for one draft (caller deletes the previous file).
 */
export function replaceDraftItemPhotoPath(
  drafts: DraftItemPhoto[],
  clientKey: string,
  nextLocalPath: string,
): DraftItemPhoto[] {
  return drafts.map((draft) => {
    if (draft.clientKey !== clientKey) {
      return draft;
    }

    return {
      ...draft,
      localPath: nextLocalPath,
      driveImageUrl: null,
      needsFinalize: true,
    };
  });
}

/**
 * Removes one draft; promotes the first remaining photo if primary was removed.
 */
export function removeDraftItemPhoto(
  drafts: DraftItemPhoto[],
  clientKey: string,
): DraftItemPhoto[] {
  const remainingDrafts = drafts.filter((draft) => draft.clientKey !== clientKey);

  if (remainingDrafts.length === 0) {
    return [];
  }

  const hasPrimary = remainingDrafts.some((draft) => draft.isPrimary);

  if (hasPrimary) {
    return remainingDrafts;
  }

  return remainingDrafts.map((draft, draftIndex) => ({
    ...draft,
    isPrimary: draftIndex === 0,
  }));
}

/**
 * Writes draft photos into item_images, renames staged files, syncs primary columns.
 */
export async function persistDraftItemPhotos(options: {
  database: SQLiteDatabase;
  itemId: number;
  houseName: string;
  itemName: string;
  houseFolderPath: string;
  drafts: DraftItemPhoto[];
}): Promise<void> {
  const { database, itemId, houseName, itemName, houseFolderPath, drafts } = options;

  const existingImages = await getImagesByItemId(database, itemId);
  const keptImageIds = new Set(
    drafts
      .map((draft) => draft.imageId)
      .filter((imageId): imageId is number => imageId !== null),
  );

  // Delete photos the user removed from the draft list.
  for (const existingImage of existingImages) {
    if (keptImageIds.has(existingImage.id)) {
      continue;
    }

    await deleteLocalImageIfExists(existingImage.localPath);
    await deleteItemImage(database, existingImage.id);
  }

  // Ensure exactly one primary when any photos remain.
  let draftsWithPrimary = drafts;

  if (draftsWithPrimary.length > 0 && !draftsWithPrimary.some((draft) => draft.isPrimary)) {
    draftsWithPrimary = draftsWithPrimary.map((draft, draftIndex) => ({
      ...draft,
      isPrimary: draftIndex === 0,
    }));
  }

  for (let draftIndex = 0; draftIndex < draftsWithPrimary.length; draftIndex += 1) {
    const draft = draftsWithPrimary[draftIndex];
    const sortOrder = draftIndex;
    const imageNumberOneBased = draftIndex + 1;

    if (draft.imageId === null) {
      const createdImage = await createItemImage(database, {
        itemId,
        localPath: draft.localPath,
        sortOrder,
        isPrimary: draft.isPrimary,
        driveImageUrl: draft.driveImageUrl,
      });

      const finalFileName = buildFinalItemImageFileName({
        houseName,
        itemName,
        imageNumberOneBased,
        photoDatabaseId: createdImage.id,
      });
      const finalLocalPath = await renameLocalItemImageFile({
        currentLocalPath: draft.localPath,
        houseFolderPath,
        finalFileName,
      });

      await updateItemImagePaths(database, createdImage.id, {
        localPath: finalLocalPath,
      });
      continue;
    }

    await updateItemImageFlags(database, draft.imageId, {
      sortOrder,
      isPrimary: draft.isPrimary,
    });

    if (draft.needsFinalize) {
      const finalFileName = buildFinalItemImageFileName({
        houseName,
        itemName,
        imageNumberOneBased,
        photoDatabaseId: draft.imageId,
      });
      const finalLocalPath = await renameLocalItemImageFile({
        currentLocalPath: draft.localPath,
        houseFolderPath,
        finalFileName,
      });

      await updateItemImagePaths(database, draft.imageId, {
        localPath: finalLocalPath,
        driveImageUrl: draft.driveImageUrl,
      });
    } else {
      await updateItemImagePaths(database, draft.imageId, {
        driveImageUrl: draft.driveImageUrl,
      });
    }
  }

  await syncItemPrimaryImageColumns(database, itemId);
}
