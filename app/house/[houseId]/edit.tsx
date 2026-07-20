import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { deleteHouse, getHouseById, updateHouseName } from '@/db/houses';
import { confirmDestructiveAction } from '@/lib/confirmDestructiveAction';
import { deleteHouseFolderIfExists } from '@/lib/houseFolders';

/**
 * Edit House: rename (display name only) or delete locally with confirmation.
 * Pattern matches Edit Category.
 */
export default function EditHouseScreen() {
  const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
  const houseId = Number(houseIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [houseName, setHouseName] = useState('');
  const [houseFolderPath, setHouseFolderPath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadHouse() {
        setIsLoading(true);

        try {
          const house = await getHouseById(database, houseId);

          if (isStillFocused) {
            if (house === null) {
              setErrorMessage('House not found.');
            } else {
              setHouseName(house.name);
              setHouseFolderPath(house.folderPath);
            }
          }
        } catch (error) {
          console.log('EditHouseScreen load error:', error);
          if (isStillFocused) {
            setErrorMessage('Could not load house.');
          }
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      void loadHouse();

      return () => {
        isStillFocused = false;
      };
    }, [database, houseId]),
  );

  /**
   * Saves the display name; keeps the on-device photo folder path unchanged.
   */
  async function handleSaveHouse() {
    const trimmedName = houseName.trim();

    if (trimmedName.length === 0) {
      setErrorMessage('Please enter a house name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateHouseName(database, houseId, trimmedName);
      router.back();
    } catch (error) {
      console.log('EditHouseScreen save error:', error);
      setErrorMessage('Could not save house name.');
      setIsSaving(false);
    }
  }

  /**
   * Deletes the house folder + SQLite row (CASCADE rooms/items). Local only.
   */
  function handleDeleteHousePress() {
    confirmDestructiveAction({
      title: 'Delete house?',
      message:
        'This removes the house, its rooms, items, and local photos from this phone. Google Sheet and Drive copies are not deleted.',
      confirmLabel: 'Delete house',
      onConfirm: () => {
        void (async () => {
          setIsDeleting(true);
          setErrorMessage(null);

          try {
            await deleteHouseFolderIfExists(houseFolderPath);
            await deleteHouse(database, houseId);
            router.replace('/');
          } catch (error) {
            console.log('EditHouseScreen delete error:', error);
            setErrorMessage('Could not delete house.');
            setIsDeleting(false);
          }
        })();
      },
    });
  }

  if (isLoading) {
    return (
      <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  const isBusy = isSaving || isDeleting;

  return (
    <KeyboardAvoidingView
      style={[screenStyles.container, { backgroundColor: colors.background, flex: 1 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Edit House</Text>
      <Text style={[screenStyles.subtitle, { color: colors.text }]}>
        Renaming changes the label in the app. Photo files stay in the same local folder.
      </Text>

      <Text style={[screenStyles.label, { color: colors.text }]}>House name</Text>
      <TextInput
        value={houseName}
        onChangeText={setHouseName}
        editable={!isBusy}
        style={[
          screenStyles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.headerBackground,
          },
        ]}
      />

      {errorMessage !== null ? (
        <Text style={screenStyles.errorText}>{errorMessage}</Text>
      ) : null}

      <Pressable
        style={[
          screenStyles.primaryButton,
          { backgroundColor: colors.tint, opacity: isBusy ? 0.7 : 1 },
        ]}
        disabled={isBusy}
        onPress={() => {
          void handleSaveHouse();
        }}>
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={screenStyles.primaryButtonText}>Save</Text>
        )}
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        disabled={isBusy}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
      </Pressable>

      <Pressable
        style={[screenStyles.destructiveTextLinkWrap, { opacity: isBusy ? 0.7 : 1 }]}
        disabled={isBusy}
        onPress={handleDeleteHousePress}
        accessibilityRole="button"
        accessibilityLabel="Delete house">
        {isDeleting ? (
          <ActivityIndicator color="#b91c1c" />
        ) : (
          <Text style={screenStyles.destructiveTextLink}>Delete house</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}
