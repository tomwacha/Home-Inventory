import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getAllCategories } from '@/db/categories';
import { getItemsByRoomId, searchItemsInRoom } from '@/db/items';
import { getRoomById } from '@/db/rooms';
import type { Item, Room } from '@/types/inventory';

/**
 * Room Page (Feature 4): search within room, then item list with thumbnails.
 */
export default function RoomScreen() {
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

  const [room, setRoom] = useState<Room | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [categoriesById, setCategoriesById] = useState<Record<number, string>>({});
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Item[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadRoomData() {
        setIsLoading(true);

        try {
          const loadedRoom = await getRoomById(database, roomId);
          const loadedItems = await getItemsByRoomId(database, roomId);
          const loadedCategories = await getAllCategories(database);

          const categoryLookup: Record<number, string> = {};
          for (const category of loadedCategories) {
            categoryLookup[category.id] = category.name;
          }

          if (isStillFocused) {
            setRoom(loadedRoom);
            setItems(loadedItems);
            setCategoriesById(categoryLookup);
          }
        } catch (error) {
          console.log('RoomScreen load error:', error);
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      void loadRoomData();

      return () => {
        isStillFocused = false;
      };
    }, [database, roomId]),
  );

  /**
   * Filters items in this room only by name or description.
   */
  async function handleSearchChange(nextSearchText: string) {
    setSearchText(nextSearchText);

    if (nextSearchText.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    try {
      const matchedItems = await searchItemsInRoom(database, roomId, nextSearchText);
      setSearchResults(matchedItems);
    } catch (error) {
      console.log('RoomScreen search error:', error);
    }
  }

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

  if (room === null) {
    return (
      <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
        <Text style={[screenStyles.title, { color: colors.text }]}>Room not found</Text>
        <Pressable
          style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => router.replace(`/house/${houseId}`)}>
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
            Back to House
          </Text>
        </Pressable>
      </View>
    );
  }

  const isSearching = searchText.trim().length > 0;
  const listItems = isSearching ? searchResults : items;

  /**
   * Renders one item row (shared by full list and search results).
   */
  function renderItemRow(item: Item) {
    const categoryName =
      item.categoryId !== null ? categoriesById[item.categoryId] : undefined;

    return (
      <Pressable
        style={[
          screenStyles.rowButton,
          {
            borderColor: colors.border,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          },
        ]}
        onPress={() =>
          router.push(`/house/${houseId}/room/${roomId}/item/${item.id}`)
        }>
        {item.localImagePath !== null ? (
          <Image
            source={{ uri: item.localImagePath }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              backgroundColor: colors.headerBackground,
            }}
            resizeMode="cover"
          />
        ) : (
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.headerBackground,
            }}>
            <Text style={{ color: colors.text, fontSize: 11, opacity: 0.7 }}>No photo</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
            {item.name}
          </Text>
          <Text style={[screenStyles.metaText, { color: colors.text }]}>
            {item.brand ?? 'No brand'}
            {categoryName ? ` · ${categoryName}` : ''}
            {` · $${item.purchasePriceUsd.toFixed(2)}`}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[screenStyles.title, { color: colors.text }]}>{room.name}</Text>
      <Text style={[screenStyles.subtitle, { color: colors.text }]}>
        Items in this room, sorted A–Z.
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 }}>
        <TextInput
          value={searchText}
          onChangeText={(nextText) => {
            void handleSearchChange(nextText);
          }}
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

      <Pressable
        style={[screenStyles.primaryButton, { backgroundColor: colors.tint, marginTop: 0 }]}
        onPress={() => router.push(`/house/${houseId}/room/${roomId}/add-item`)}>
        <Text style={screenStyles.primaryButtonText}>Add Item</Text>
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.push(`/house/${houseId}/room/${roomId}/edit`)}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Edit Room
        </Text>
      </Pressable>

      <FlatList
        data={listItems}
        keyExtractor={(item) => String(item.id)}
        style={{ marginTop: 16 }}
        ListEmptyComponent={
          <Text style={[screenStyles.emptyText, { color: colors.text }]}>
            {isSearching
              ? 'No items matched your search in this room.'
              : 'No items yet. Tap Add Item to catalog something in this room.'}
          </Text>
        }
        renderItem={({ item }) => renderItemRow(item)}
      />

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.push(`/house/${houseId}`)}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Back to House
        </Text>
      </Pressable>
    </View>
  );
}
