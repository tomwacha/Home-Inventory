import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getAllHouses } from '@/db/houses';
import type { House } from '@/types/inventory';

/**
 * Welcome screen (Feature 2): Add House + View House list from SQLite.
 */
export default function WelcomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [houses, setHouses] = useState<House[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadHouses() {
        setIsLoading(true);
        setErrorMessage(null);

        try {
          const loadedHouses = await getAllHouses(database);
          if (isStillFocused) {
            setHouses(loadedHouses);
          }
        } catch (error) {
          console.log('WelcomeScreen loadHouses error:', error);
          if (isStillFocused) {
            setErrorMessage('Could not load houses. Check the console for details.');
          }
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      loadHouses();

      return () => {
        isStillFocused = false;
      };
    }, [database]),
  );

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[screenStyles.title, { color: colors.text, textAlign: 'center' }]}>
        Welcome to Home Inventory
      </Text>
      <Text style={[screenStyles.subtitle, { color: colors.text, textAlign: 'center' }]}>
        Track your possessions for insurance claims, fully offline on your device.
      </Text>

      {/* Pressable + router.push (not Link asChild) so Android paints the blue button. */}
      <Pressable
        style={[screenStyles.primaryButton, { backgroundColor: colors.tint }]}
        accessibilityRole="button"
        onPress={() => router.push('/add-house')}>
        <Text style={screenStyles.primaryButtonText}>Add House</Text>
      </Pressable>

      <Text style={[screenStyles.label, { color: colors.text }]}>View House</Text>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 12 }} />
      ) : null}

      {errorMessage !== null ? (
        <Text style={screenStyles.errorText}>{errorMessage}</Text>
      ) : null}

      {!isLoading && houses.length === 0 ? (
        <Text style={[screenStyles.emptyText, { color: colors.text }]}>
          No houses yet. Tap Add House to create your first one.
        </Text>
      ) : null}

      <FlatList
        data={houses}
        keyExtractor={(house) => String(house.id)}
        style={styles.houseList}
        renderItem={({ item }) => (
          <Pressable
            style={[screenStyles.rowButton, { borderColor: colors.border }]}
            onPress={() => router.push(`/house/${item.id}`)}>
            <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  houseList: {
    marginTop: 4,
  },
});
