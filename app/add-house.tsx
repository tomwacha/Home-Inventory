import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
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
import { createHouse } from '@/db/houses';
import { createHouseFolderOnDevice } from '@/lib/houseFolders';

/**
 * Add House screen: saves a SQLite row and creates an on-device folder.
 */
export default function AddHouseScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [houseName, setHouseName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Creates the folder first, then inserts the house row, then opens that house.
   */
  async function handleSaveHouse() {
    const trimmedHouseName = houseName.trim();

    if (trimmedHouseName.length === 0) {
      setErrorMessage('Please enter a house name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const folderPath = await createHouseFolderOnDevice(trimmedHouseName);
      const createdHouse = await createHouse(database, {
        name: trimmedHouseName,
        folderPath,
      });

      router.replace(`/house/${createdHouse.id}`);
    } catch (error) {
      console.log('AddHouseScreen save error:', error);
      setErrorMessage('Could not save the house. Check the console for details.');
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[screenStyles.container, { backgroundColor: colors.background, flex: 1 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Add House</Text>
      <Text style={[screenStyles.subtitle, { color: colors.text }]}>
        This creates a local folder for photos and a database record for the house.
      </Text>

      <Text style={[screenStyles.label, { color: colors.text }]}>House name</Text>
      <TextInput
        value={houseName}
        onChangeText={setHouseName}
        placeholder="e.g. Main Street Home"
        placeholderTextColor={colors.border}
        autoFocus
        style={[
          screenStyles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
        ]}
      />

      {errorMessage !== null ? (
        <Text style={screenStyles.errorText}>{errorMessage}</Text>
      ) : null}

      <Pressable
        style={[
          screenStyles.primaryButton,
          { backgroundColor: colors.tint, opacity: isSaving ? 0.7 : 1 },
        ]}
        disabled={isSaving}
        onPress={handleSaveHouse}
        accessibilityRole="button">
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={screenStyles.primaryButtonText}>Save House</Text>
        )}
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        disabled={isSaving}
        onPress={() => router.back()}
        accessibilityRole="button">
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
