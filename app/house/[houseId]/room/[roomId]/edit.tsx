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
import { deleteRoom, getRoomById, updateRoomName } from '@/db/rooms';
import { confirmDestructiveAction } from '@/lib/confirmDestructiveAction';

/**
 * Edit Room: rename or delete locally with confirmation.
 * Pattern matches Edit Category / Edit House.
 */
export default function EditRoomScreen() {
  const { houseId: houseIdParam, roomId: roomIdParam } = useLocalSearchParams<{
    houseId: string;
    roomId: string;
  }>();
  const houseId = Number(houseIdParam);
  const roomId = Number(roomIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [roomName, setRoomName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadRoom() {
        setIsLoading(true);

        try {
          const room = await getRoomById(database, roomId);

          if (isStillFocused) {
            if (room === null) {
              setErrorMessage('Room not found.');
            } else {
              setRoomName(room.name);
            }
          }
        } catch (error) {
          console.log('EditRoomScreen load error:', error);
          if (isStillFocused) {
            setErrorMessage('Could not load room.');
          }
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      void loadRoom();

      return () => {
        isStillFocused = false;
      };
    }, [database, roomId]),
  );

  async function handleSaveRoom() {
    const trimmedName = roomName.trim();

    if (trimmedName.length === 0) {
      setErrorMessage('Please enter a room name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateRoomName(database, roomId, trimmedName);
      router.back();
    } catch (error) {
      console.log('EditRoomScreen save error:', error);
      setErrorMessage('Could not save room name.');
      setIsSaving(false);
    }
  }

  function handleDeleteRoomPress() {
    confirmDestructiveAction({
      title: 'Delete room?',
      message:
        'This removes the room and all of its items from this phone. Google Sheet and Drive copies are not deleted.',
      confirmLabel: 'Delete room',
      onConfirm: () => {
        void (async () => {
          setIsDeleting(true);
          setErrorMessage(null);

          try {
            await deleteRoom(database, roomId);
            router.replace(`/house/${houseId}`);
          } catch (error) {
            console.log('EditRoomScreen delete error:', error);
            setErrorMessage('Could not delete room.');
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
      <Text style={[screenStyles.title, { color: colors.text }]}>Edit Room</Text>

      <Text style={[screenStyles.label, { color: colors.text }]}>Room name</Text>
      <TextInput
        value={roomName}
        onChangeText={setRoomName}
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
          void handleSaveRoom();
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
        onPress={handleDeleteRoomPress}
        accessibilityRole="button"
        accessibilityLabel="Delete room">
        {isDeleting ? (
          <ActivityIndicator color="#b91c1c" />
        ) : (
          <Text style={screenStyles.destructiveTextLink}>Delete room</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}
