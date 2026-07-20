import { useLocalSearchParams, useRouter } from 'expo-router';
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
import { createRoom } from '@/db/rooms';

/**
 * Add Room form — fills a gap in the product brief so houses can gain rooms.
 */
export default function AddRoomScreen() {
  const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
  const houseId = Number(houseIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [roomName, setRoomName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSaveRoom() {
    const trimmedRoomName = roomName.trim();

    if (Number.isNaN(houseId)) {
      setErrorMessage('Invalid house id.');
      return;
    }

    if (trimmedRoomName.length === 0) {
      setErrorMessage('Please enter a room name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const createdRoom = await createRoom(database, {
        houseId,
        name: trimmedRoomName,
      });
      router.replace(`/house/${houseId}/room/${createdRoom.id}`);
    } catch (error) {
      console.log('AddRoomScreen save error:', error);
      setErrorMessage('Could not save the room.');
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[screenStyles.container, { backgroundColor: colors.background, flex: 1 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Add Room</Text>

      <Text style={[screenStyles.label, { color: colors.text }]}>Room name *</Text>
      <TextInput
        value={roomName}
        onChangeText={setRoomName}
        placeholder="e.g. Living Room"
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
        onPress={handleSaveRoom}>
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={screenStyles.primaryButtonText}>Save Room</Text>
        )}
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        disabled={isSaving}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
