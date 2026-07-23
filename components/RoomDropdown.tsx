import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import type { Room } from '@/types/inventory';

type RoomDropdownProps = {
  rooms: Room[];
  selectedRoomId: number;
  onSelectRoomId: (roomId: number) => void;
  disabled?: boolean;
};

/**
 * Compact room selector for Edit Item (switch which room owns this item).
 * Analogy: picking a different drawer for the same inventory card.
 */
export default function RoomDropdown({
  rooms,
  selectedRoomId,
  onSelectRoomId,
  disabled = false,
}: RoomDropdownProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [isOpen, setIsOpen] = useState(false);

  const selectedRoom = rooms.find((room) => room.id === selectedRoomId);
  const displayLabel =
    selectedRoom !== undefined ? selectedRoom.name : 'Select a room';

  /**
   * Chooses a room and closes the modal.
   */
  function handleSelect(roomId: number) {
    onSelectRoomId(roomId);
    setIsOpen(false);
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select room"
        disabled={disabled}
        onPress={() => setIsOpen(true)}
        style={[
          screenStyles.rowButton,
          {
            borderColor: colors.border,
            backgroundColor: colors.headerBackground,
            opacity: disabled ? 0.7 : 1,
          },
        ]}>
        <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
          {displayLabel}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.text} />
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsOpen(false)}>
          <Pressable
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.headerBackground,
                borderColor: colors.border,
              },
            ]}
            onPress={(event) => {
              // Keep taps inside the card from closing via the backdrop Pressable.
              event.stopPropagation();
            }}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Room</Text>

            <FlatList
              data={rooms}
              keyExtractor={(room) => String(room.id)}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No rooms in this house yet.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.optionRow, { borderColor: colors.border }]}
                  onPress={() => handleSelect(item.id)}>
                  <Text style={{ color: colors.text, fontSize: 16 }}>
                    {selectedRoomId === item.id ? `✓ ${item.name}` : item.name}
                  </Text>
                </Pressable>
              )}
            />

            <Pressable
              style={[styles.closeButton, { borderColor: colors.border }]}
              onPress={() => setIsOpen(false)}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    maxHeight: '70%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  optionRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyText: {
    fontSize: 14,
    opacity: 0.75,
    marginBottom: 12,
  },
  closeButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
});
