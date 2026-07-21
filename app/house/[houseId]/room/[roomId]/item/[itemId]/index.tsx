import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getCategoryById } from '@/db/categories';
import { getImagesByItemId } from '@/db/itemImages';
import { getItemById } from '@/db/items';
import type { Item, ItemImage } from '@/types/inventory';

/**
 * Item detail page (Feature 5) with primary photo + thumbnail strip.
 * Delete lives on Edit Item to avoid accidental taps next to Edit / Back.
 */
export default function ItemDetailScreen() {
  const {
    houseId: houseIdParam,
    roomId: roomIdParam,
    itemId: itemIdParam,
  } = useLocalSearchParams<{
    houseId: string;
    roomId: string;
    itemId: string;
  }>();
  const houseId = Number(houseIdParam);
  const roomId = Number(roomIdParam);
  const itemId = Number(itemIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [item, setItem] = useState<Item | null>(null);
  const [itemImages, setItemImages] = useState<ItemImage[]>([]);
  const [selectedImagePath, setSelectedImagePath] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadItem() {
        setIsLoading(true);

        try {
          const loadedItem = await getItemById(database, itemId);
          const loadedImages = await getImagesByItemId(database, itemId);
          let loadedCategoryName: string | null = null;

          if (loadedItem?.categoryId !== null && loadedItem?.categoryId !== undefined) {
            const category = await getCategoryById(database, loadedItem.categoryId);
            loadedCategoryName = category?.name ?? null;
          }

          if (isStillFocused) {
            setItem(loadedItem);
            setItemImages(loadedImages);
            const primaryImage =
              loadedImages.find((image) => image.isPrimary) ?? loadedImages[0] ?? null;
            setSelectedImagePath(
              primaryImage?.localPath ?? loadedItem?.localImagePath ?? null,
            );
            setCategoryName(loadedCategoryName);
          }
        } catch (error) {
          console.log('ItemDetailScreen load error:', error);
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      loadItem();

      return () => {
        isStillFocused = false;
      };
    }, [database, itemId]),
  );

  /**
   * Friendly label for how far this item has synced to Google Sheets.
   */
  function getSyncStatusLabel(syncStatus: Item['syncStatus']): string {
    if (syncStatus === 'synced') {
      return 'Synced to Google Sheets';
    }

    if (syncStatus === 'conflict') {
      return 'Conflict — review on next export';
    }

    return 'Local only (not uploaded yet)';
  }

  if (isLoading) {
    return (
      <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  if (item === null) {
    return (
      <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
        <Text style={[screenStyles.title, { color: colors.text }]}>Item not found</Text>
        <Pressable
          style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => router.replace(`/house/${houseId}/room/${roomId}`)}>
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
            Back to Room
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={screenStyles.container}>
      {selectedImagePath !== null ? (
        <Image
          source={{ uri: selectedImagePath }}
          style={{
            width: '100%',
            height: 260,
            borderRadius: 12,
            marginBottom: 12,
            backgroundColor: colors.headerBackground,
          }}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            screenStyles.secondaryButton,
            { borderColor: colors.border, marginTop: 0, paddingVertical: 48 },
          ]}>
          <Text style={[screenStyles.metaText, { color: colors.text, textAlign: 'center' }]}>
            No photo yet — tap Edit Item to add one.
          </Text>
        </View>
      )}

      {itemImages.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
          contentContainerStyle={{ flexDirection: 'row', gap: 8 }}>
          {itemImages.map((image) => {
            if (image.localPath === null) {
              return null;
            }

            const isSelected = image.localPath === selectedImagePath;

            return (
              <Pressable
                key={image.id}
                accessibilityRole="button"
                accessibilityLabel={
                  image.isPrimary ? 'Primary photo' : 'Additional photo'
                }
                onPress={() => setSelectedImagePath(image.localPath)}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 8,
                  overflow: 'hidden',
                  borderWidth: isSelected ? 2 : 1,
                  borderColor: isSelected ? colors.tint : colors.border,
                }}>
                <Image
                  source={{ uri: image.localPath }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                />
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <Text style={[screenStyles.title, { color: colors.text }]}>{item.name}</Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Brand: {item.brand ?? '—'}
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Model: {item.model ?? '—'}
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Category: {categoryName ?? '—'}
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Purchase price: ${item.purchasePriceUsd.toFixed(2)}
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Purchase date: {item.purchaseDate ?? '—'}
      </Text>
      <Text style={[screenStyles.label, { color: colors.text }]}>Description</Text>
      <Text style={[{ color: colors.text, fontSize: 16, lineHeight: 22 }]}>
        {item.description ?? '—'}
      </Text>

      <Text style={[screenStyles.metaText, { color: colors.text, marginTop: 12 }]}>
        Sync: {getSyncStatusLabel(item.syncStatus)}
      </Text>

      <Pressable
        style={[screenStyles.primaryButton, { backgroundColor: colors.tint }]}
        onPress={() =>
          router.push(`/house/${houseId}/room/${roomId}/item/${itemId}/edit`)
        }>
        <Text style={screenStyles.primaryButtonText}>Edit Item</Text>
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.push(`/house/${houseId}/room/${roomId}/add-item`)}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Add Another Item
        </Text>
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.push(`/house/${houseId}/room/${roomId}`)}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Back to Room
        </Text>
      </Pressable>
    </ScrollView>
  );
}
