import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import ImagePickerField from '@/components/ImagePickerField';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getAppSettings } from '@/db/settings';
import {
  deleteLocalImageIfExists,
  pickDownscaleAndSaveItemImage,
  type ImageSourceChoice,
} from '@/lib/images';
import {
  appendDraftItemPhoto,
  removeDraftItemPhoto,
  replaceDraftItemPhotoPath,
  setDraftItemPhotoPrimary,
  type DraftItemPhoto,
} from '@/lib/persistItemPhotos';

type ItemPhotoStripProps = {
  drafts: DraftItemPhoto[];
  houseFolderPath: string;
  onDraftsChange: (nextDrafts: DraftItemPhoto[]) => void;
  onError?: (errorMessage: string) => void;
  disabled?: boolean;
};

/**
 * Primary photo tile + horizontal thumbnails + Add photo for multi-photo items.
 */
export default function ItemPhotoStrip({
  drafts,
  houseFolderPath,
  onDraftsChange,
  onError,
  disabled = false,
}: ItemPhotoStripProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const primaryDraft =
    drafts.find((draft) => draft.isPrimary) ?? drafts[0] ?? null;
  const stripDrafts = drafts.filter(
    (draft) => primaryDraft === null || draft.clientKey !== primaryDraft.clientKey,
  );

  /**
   * Picks a photo from camera or gallery and returns the saved local URI.
   */
  async function pickPhotoFromSource(
    source: ImageSourceChoice,
  ): Promise<string | null> {
    if (houseFolderPath.trim().length === 0) {
      onError?.('House folder is missing. Save the house again before adding photos.');
      return null;
    }

    return pickDownscaleAndSaveItemImage({
      source,
      houseFolderPath,
    });
  }

  /**
   * ImagePickerField callback: set/replace/clear the primary photo.
   */
  async function handlePrimaryImageChange(nextImageUri: string | null) {
    if (nextImageUri === null) {
      if (primaryDraft === null) {
        return;
      }

      const nextDrafts = removeDraftItemPhoto(drafts, primaryDraft.clientKey);
      onDraftsChange(nextDrafts);
      return;
    }

    if (primaryDraft === null) {
      onDraftsChange(appendDraftItemPhoto(drafts, nextImageUri));
      return;
    }

    const previousLocalPath = primaryDraft.localPath;
    const nextDrafts = replaceDraftItemPhotoPath(
      drafts,
      primaryDraft.clientKey,
      nextImageUri,
    );
    onDraftsChange(nextDrafts);

    if (previousLocalPath !== nextImageUri) {
      await deleteLocalImageIfExists(previousLocalPath);
    }
  }

  /**
   * Adds another photo using Settings default source (camera or gallery).
   */
  async function handleAddPhotoPress() {
    if (disabled || isProcessingPhoto) {
      return;
    }

    setIsProcessingPhoto(true);

    try {
      const appSettings = await getAppSettings(database);
      const savedImageUri = await pickPhotoFromSource(appSettings.defaultImageSource);

      if (savedImageUri === null) {
        return;
      }

      onDraftsChange(appendDraftItemPhoto(drafts, savedImageUri));
    } catch (error) {
      console.log('ItemPhotoStrip add photo error:', error);
      const message =
        error instanceof Error ? error.message : 'Could not add the photo.';
      onError?.(message);
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  /**
   * Thumb ActionSheet: set primary, replace, or remove.
   */
  function handleThumbPress(draft: DraftItemPhoto) {
    if (disabled || isProcessingPhoto) {
      return;
    }

    Alert.alert('Photo options', 'What would you like to do with this photo?', [
      {
        text: 'Set as primary',
        onPress: () => {
          onDraftsChange(setDraftItemPhotoPrimary(drafts, draft.clientKey));
        },
      },
      {
        text: 'Replace photo',
        onPress: () => {
          void (async () => {
            setIsProcessingPhoto(true);

            try {
              const appSettings = await getAppSettings(database);
              const savedImageUri = await pickPhotoFromSource(
                appSettings.defaultImageSource,
              );

              if (savedImageUri === null) {
                return;
              }

              const previousLocalPath = draft.localPath;
              onDraftsChange(
                replaceDraftItemPhotoPath(drafts, draft.clientKey, savedImageUri),
              );
              await deleteLocalImageIfExists(previousLocalPath);
            } catch (error) {
              console.log('ItemPhotoStrip replace error:', error);
              onError?.(
                error instanceof Error ? error.message : 'Could not replace the photo.',
              );
            } finally {
              setIsProcessingPhoto(false);
            }
          })();
        },
      },
      {
        text: 'Remove photo',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteLocalImageIfExists(draft.localPath);
            onDraftsChange(removeDraftItemPhoto(drafts, draft.clientKey));
          })();
        },
      },
      {
        text: 'Cancel',
        style: 'cancel',
      },
    ]);
  }

  return (
    <View>
      <ImagePickerField
        imageUri={primaryDraft?.localPath ?? null}
        houseFolderPath={houseFolderPath}
        onImageChange={(nextImageUri) => {
          void handlePrimaryImageChange(nextImageUri);
        }}
        onError={onError}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stripContent}>
        {stripDrafts.map((draft) => (
          <Pressable
            key={draft.clientKey}
            accessibilityRole="button"
            accessibilityLabel="Photo thumbnail options"
            disabled={disabled || isProcessingPhoto}
            onPress={() => handleThumbPress(draft)}
            style={[
              styles.thumbFrame,
              {
                borderColor: colors.border,
                backgroundColor: colors.headerBackground,
                opacity: disabled || isProcessingPhoto ? 0.7 : 1,
              },
            ]}>
            <Image
              source={{ uri: draft.localPath }}
              style={styles.thumbImage}
              resizeMode="cover"
            />
          </Pressable>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add photo"
          disabled={disabled || isProcessingPhoto}
          onPress={() => {
            void handleAddPhotoPress();
          }}
          style={[
            styles.addPhotoButton,
            {
              borderColor: colors.border,
              backgroundColor: colors.headerBackground,
              opacity: disabled || isProcessingPhoto ? 0.7 : 1,
            },
          ]}>
          {isProcessingPhoto ? (
            <ActivityIndicator color={colors.tint} />
          ) : (
            <Text style={[styles.addPhotoLabel, { color: colors.text }]}>Add photo</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stripContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 8,
  },
  thumbFrame: {
    width: 72,
    height: 72,
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  addPhotoButton: {
    minWidth: 72,
    height: 72,
    borderWidth: 1,
    borderRadius: 8,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  addPhotoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
