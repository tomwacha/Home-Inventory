import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { getAllHouses } from '@/db/houses';
import type { House } from '@/types/inventory';

type AppHeaderProps = {
  /** When true, shows the house selector on the right. */
  showHouseSelector?: boolean;
};

/**
 * Stationary top header with the app title and a house dropdown (Feature 1).
 */
export default function AppHeader({ showHouseSelector = true }: AppHeaderProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const database = useSQLiteContext();

  const [houses, setHouses] = useState<House[]>([]);
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);

  /**
   * Loads the latest houses from SQLite into the dropdown.
   */
  const loadHouses = useCallback(async () => {
    try {
      const loadedHouses = await getAllHouses(database);
      setHouses(loadedHouses);
    } catch (error) {
      console.log('AppHeader failed to load houses:', error);
    }
  }, [database]);

  // Header sits outside Stack screens, so useFocusEffect is unreliable.
  // Reload whenever the route changes (e.g. after Add House) and on first mount.
  useEffect(() => {
    void loadHouses();
  }, [loadHouses, pathname]);

  /**
   * Opens the dropdown after refreshing the house list.
   */
  function handleOpenSelector() {
    void loadHouses();
    setIsSelectorOpen(true);
  }

  /**
   * Opens the selected house main page and closes the dropdown.
   */
  function handleSelectHouse(house: House) {
    setIsSelectorOpen(false);
    router.push(`/house/${house.id}`);
  }

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          backgroundColor: colors.headerBackground,
          borderBottomColor: colors.border,
        },
      ]}>
      <Pressable onPress={() => router.push('/')} accessibilityRole="button">
        <Text style={[styles.title, { color: colors.text }]}>Home Inventory</Text>
      </Pressable>

      {showHouseSelector ? (
        <TouchableOpacity
          style={[styles.selector, { borderColor: colors.border }]}
          onPress={handleOpenSelector}
          accessibilityLabel="Select house">
          <Text style={[styles.selectorText, { color: colors.text }]}>
            {houses.length > 0 ? 'Select house' : 'No houses'}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.text} />
        </TouchableOpacity>
      ) : null}

      <Modal
        visible={isSelectorOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSelectorOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setIsSelectorOpen(false)}>
          <View
            style={[
              styles.modalCard,
              {
                backgroundColor: colors.headerBackground,
                borderColor: colors.border,
              },
            ]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Houses</Text>

            {houses.length === 0 ? (
              <Text style={[styles.emptyText, { color: colors.text }]}>
                Add a house from the welcome screen first.
              </Text>
            ) : (
              <FlatList
                data={houses}
                keyExtractor={(house) => String(house.id)}
                renderItem={({ item }) => (
                  <Pressable
                    style={[styles.houseRow, { borderColor: colors.border }]}
                    onPress={() => handleSelectHouse(item)}>
                    <Text style={{ color: colors.text, fontSize: 16 }}>{item.name}</Text>
                  </Pressable>
                )}
              />
            )}

            <Pressable
              style={[styles.closeButton, { borderColor: colors.border }]}
              onPress={() => setIsSelectorOpen(false)}>
              <Text style={{ color: colors.text, fontWeight: '600' }}>Close</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderRadius: 8,
  },
  selectorText: {
    fontSize: 14,
  },
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
  houseRow: {
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
