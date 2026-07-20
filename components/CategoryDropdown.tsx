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
import type { Category } from '@/types/inventory';

type CategoryDropdownProps = {
  categories: Category[];
  selectedCategoryId: number | null;
  onSelectCategoryId: (categoryId: number | null) => void;
  /** Opens the manage-categories screen (add/rename). */
  onPressManageCategories: () => void;
  disabled?: boolean;
};

/**
 * Compact category selector: one closed row + modal list (None + categories).
 * Analogy: a labeled folder tab that opens a short menu instead of dumping every folder on the desk.
 */
export default function CategoryDropdown({
  categories,
  selectedCategoryId,
  onSelectCategoryId,
  onPressManageCategories,
  disabled = false,
}: CategoryDropdownProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const [isOpen, setIsOpen] = useState(false);

  const selectedCategory = categories.find(
    (category) => category.id === selectedCategoryId,
  );
  const displayLabel =
    selectedCategory !== undefined ? selectedCategory.name : 'None';

  /**
   * Chooses a category (or None) and closes the modal.
   */
  function handleSelect(categoryId: number | null) {
    onSelectCategoryId(categoryId);
    setIsOpen(false);
  }

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Select category"
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
            <Text style={[styles.modalTitle, { color: colors.text }]}>Category</Text>

            <FlatList
              data={categories}
              keyExtractor={(category) => String(category.id)}
              ListHeaderComponent={
                <Pressable
                  style={[styles.optionRow, { borderColor: colors.border }]}
                  onPress={() => handleSelect(null)}>
                  <Text style={{ color: colors.text, fontSize: 16 }}>
                    {selectedCategoryId === null ? '✓ None' : 'None'}
                  </Text>
                </Pressable>
              }
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.text }]}>
                  No categories yet. Use Manage categories to add one.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.optionRow, { borderColor: colors.border }]}
                  onPress={() => handleSelect(item.id)}>
                  <Text style={{ color: colors.text, fontSize: 16 }}>
                    {selectedCategoryId === item.id ? `✓ ${item.name}` : item.name}
                  </Text>
                </Pressable>
              )}
            />

            <Pressable
              style={[styles.manageButton, { borderColor: colors.border }]}
              onPress={() => {
                setIsOpen(false);
                onPressManageCategories();
              }}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>
                Manage categories
              </Text>
            </Pressable>

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
  manageButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButton: {
    marginTop: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: 8,
    alignItems: 'center',
  },
});
