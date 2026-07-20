import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import {
  deleteLocalImageIfExists,
  pickDownscaleAndSaveItemImage,
  type ImageSourceChoice,
} from '@/lib/images';

type ImagePickerFieldProps = {
  /** Current local image URI, or null when empty. */
  imageUri: string | null;
  /** House folder where new photos should be saved. */
  houseFolderPath: string;
  /** Called after a successful pick/clear so the parent can store the path. */
  onImageChange: (nextImageUri: string | null) => void;
  /** Optional error callback for permission / save failures. */
  onError?: (errorMessage: string) => void;
};

/**
 * Tappable photo area with Camera / Gallery / Remove ActionSheet (Option A).
 * Analogy: a photo frame you tap to open a small menu of ways to fill it.
 */
export default function ImagePickerField({
  imageUri,
  houseFolderPath,
  onImageChange,
  onError,
}: ImagePickerFieldProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  /**
   * Runs the pick → downscale → save pipeline for camera or gallery.
   */
  async function handlePickFromSource(source: ImageSourceChoice) {
    if (houseFolderPath.trim().length === 0) {
      onError?.('House folder is missing. Save the house again before adding photos.');
      return;
    }

    setIsProcessingPhoto(true);

    try {
      const previousImageUri = imageUri;
      const savedImageUri = await pickDownscaleAndSaveItemImage({
        source,
        houseFolderPath,
      });

      // User cancelled the system picker — leave the existing photo alone.
      if (savedImageUri === null) {
        return;
      }

      onImageChange(savedImageUri);

      // Free disk space when replacing an older photo for this item.
      if (previousImageUri !== null && previousImageUri !== savedImageUri) {
        await deleteLocalImageIfExists(previousImageUri);
      }
    } catch (error) {
      console.log('ImagePickerField pick error:', error);
      const message =
        error instanceof Error ? error.message : 'Could not save the photo.';
      onError?.(message);
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  /**
   * Clears the selected photo and deletes the file when present.
   */
  async function handleRemovePhoto() {
    setIsProcessingPhoto(true);

    try {
      await deleteLocalImageIfExists(imageUri);
      onImageChange(null);
    } catch (error) {
      console.log('ImagePickerField remove error:', error);
      onError?.('Could not remove the photo.');
    } finally {
      setIsProcessingPhoto(false);
    }
  }

  /**
   * Shows Camera / Gallery / Remove / Cancel choices (ActionSheet via Alert).
   */
  function handleOpenPhotoMenu() {
    if (isProcessingPhoto) {
      return;
    }

    const alertButtons: {
      text: string;
      style?: 'cancel' | 'destructive' | 'default';
      onPress?: () => void;
    }[] = [
      {
        text: 'Take photo',
        onPress: () => {
          void handlePickFromSource('camera');
        },
      },
      {
        text: 'Choose from gallery',
        onPress: () => {
          void handlePickFromSource('gallery');
        },
      },
    ];

    if (imageUri !== null) {
      alertButtons.push({
        text: 'Remove photo',
        style: 'destructive',
        onPress: () => {
          void handleRemovePhoto();
        },
      });
    }

    alertButtons.push({
      text: 'Cancel',
      style: 'cancel',
    });

    Alert.alert('Item photo', 'How would you like to add a picture?', alertButtons);
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Add or change item photo"
      disabled={isProcessingPhoto}
      onPress={handleOpenPhotoMenu}
      style={[
        styles.frame,
        {
          borderColor: colors.border,
          backgroundColor: colors.headerBackground,
          opacity: isProcessingPhoto ? 0.7 : 1,
        },
      ]}>
      {isProcessingPhoto ? (
        <ActivityIndicator />
      ) : imageUri !== null ? (
        <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
      ) : (
        <View style={styles.placeholderContent}>
          <Text style={[styles.placeholderTitle, { color: colors.text }]}>Add photo</Text>
          <Text style={[styles.placeholderHint, { color: colors.text }]}>
            Tap to use camera or gallery
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  frame: {
    marginTop: 0,
    marginBottom: 8,
    minHeight: 180,
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: 220,
  },
  placeholderContent: {
    paddingVertical: 40,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  placeholderHint: {
    fontSize: 14,
    opacity: 0.75,
    textAlign: 'center',
  },
});
