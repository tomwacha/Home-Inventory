import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getHouseById } from '@/db/houses';
import { getHouseTotals, searchItemsInHouse } from '@/db/items';
import { getRoomsByHouseId } from '@/db/rooms';
import type { House, HouseTotals, Item, Room } from '@/types/inventory';

/**
 * House Main Page (Feature 3): totals, search, room list, export/import links.
 */
export default function HouseMainScreen() {
  const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
  const houseId = Number(houseIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [house, setHouse] = useState<House | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [totals, setTotals] = useState<HouseTotals>({ itemCount: 0, totalValueUsd: 0 });
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadHouseData() {
        if (Number.isNaN(houseId)) {
          setErrorMessage('Invalid house id.');
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
          const loadedHouse = await getHouseById(database, houseId);
          const loadedRooms = await getRoomsByHouseId(database, houseId);
          const loadedTotals = await getHouseTotals(database, houseId);

          if (isStillFocused) {
            setHouse(loadedHouse);
            setRooms(loadedRooms);
            setTotals(loadedTotals);
          }
        } catch (error) {
          console.log('HouseMainScreen load error:', error);
          if (isStillFocused) {
            setErrorMessage('Could not load this house.');
          }
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      loadHouseData();

      return () => {
        isStillFocused = false;
      };
    }, [database, houseId]),
  );

  /**
   * Runs the Feature 3 name/description search against items in this house.
   */
  async function handleSearchChange(nextSearchText: string) {
    setSearchText(nextSearchText);

    if (nextSearchText.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    try {
      const matchedItems = await searchItemsInHouse(database, houseId, nextSearchText);
      setSearchResults(matchedItems);
    } catch (error) {
      console.log('HouseMainScreen search error:', error);
    }
  }

  /**
   * Clears the search box and results (the X button).
   */
  function handleClearSearch() {
    setSearchText('');
    setSearchResults([]);
  }

  if (isLoading) {
    return (
      <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (house === null) {
    return (
      <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
        <Text style={[screenStyles.title, { color: colors.text }]}>House not found</Text>
        <Pressable
          style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => router.replace('/')}>
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
            Back to Welcome
          </Text>
        </Pressable>
      </View>
    );
  }

  const isSearching = searchText.trim().length > 0;

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[screenStyles.title, { color: colors.text }]}>{house.name}</Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        {totals.itemCount} items · ${totals.totalValueUsd.toFixed(2)} total value
      </Text>

      {errorMessage !== null ? (
        <Text style={screenStyles.errorText}>{errorMessage}</Text>
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 8 }}>
        <TextInput
          value={searchText}
          onChangeText={handleSearchChange}
          placeholder="Search items by name or description"
          placeholderTextColor={colors.border}
          style={[
            screenStyles.input,
            {
              flex: 1,
              color: colors.text,
              borderColor: colors.border,
              backgroundColor: colors.headerBackground,
              marginTop: 0,
            },
          ]}
        />
        <Pressable
          onPress={handleClearSearch}
          accessibilityLabel="Clear search"
          style={[
            screenStyles.secondaryButton,
            { borderColor: colors.border, marginTop: 0, paddingHorizontal: 12 },
          ]}>
          <Ionicons name="close" size={18} color={colors.text} />
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <Pressable
          style={[screenStyles.secondaryButton, { flex: 1, borderColor: colors.border, marginTop: 0 }]}
          onPress={() => router.push(`/house/${houseId}/export`)}>
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Export</Text>
        </Pressable>
        <Pressable
          style={[screenStyles.secondaryButton, { flex: 1, borderColor: colors.border, marginTop: 0 }]}
          onPress={() => router.push(`/house/${houseId}/import`)}>
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Import</Text>
        </Pressable>
      </View>

      <Pressable
        style={[screenStyles.primaryButton, { backgroundColor: colors.tint }]}
        onPress={() => router.push(`/house/${houseId}/add-room`)}>
        <Text style={screenStyles.primaryButtonText}>Add Room</Text>
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.push(`/house/${houseId}/edit`)}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Edit House
        </Text>
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.push('/categories')}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Manage Categories
        </Text>
      </Pressable>

      <Text style={[screenStyles.label, { color: colors.text }]}>
        {isSearching ? 'Search results' : 'Rooms'}
      </Text>

      {isSearching ? (
        <FlatList
          data={searchResults}
          keyExtractor={(item) => String(item.id)}
          ListEmptyComponent={
            <Text style={[screenStyles.emptyText, { color: colors.text }]}>
              No items matched your search.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[screenStyles.rowButton, { borderColor: colors.border }]}
              onPress={() =>
                router.push(`/house/${houseId}/room/${item.roomId}/item/${item.id}`)
              }>
              <View>
                <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
                  {item.name}
                </Text>
                <Text style={[screenStyles.metaText, { color: colors.text }]}>
                  ${item.purchasePriceUsd.toFixed(2)}
                </Text>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={rooms}
          keyExtractor={(room) => String(room.id)}
          ListEmptyComponent={
            <Text style={[screenStyles.emptyText, { color: colors.text }]}>
              No rooms yet. Tap Add Room to create one.
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable
              style={[screenStyles.rowButton, { borderColor: colors.border }]}
              onPress={() => router.push(`/house/${houseId}/room/${item.id}`)}>
              <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
                {item.name}
              </Text>
              <Ionicons name="chevron-forward" size={18} color={colors.text} />
            </Pressable>
          )}
        />
      )}

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.replace('/')}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Back to Welcome
        </Text>
      </Pressable>
    </View>
  );
}
