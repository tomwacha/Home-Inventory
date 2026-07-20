import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getCategoryById } from '@/db/categories';
import { deleteItem, getItemById } from '@/db/items';
import { confirmDestructiveAction } from '@/lib/confirmDestructiveAction';
import { deleteLocalImageIfExists } from '@/lib/images';
import type { Item } from '@/types/inventory';

/**
 * Item detail page (Feature 5) with full local photo when present.
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
  const [categoryName, setCategoryName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadItem() {
        setIsLoading(true);

        try {
          const loadedItem = await getItemById(database, itemId);
          let loadedCategoryName: string | null = null;

          if (loadedItem?.categoryId !== null && loadedItem?.categoryId !== undefined) {
            const category = await getCategoryById(database, loadedItem.categoryId);
            loadedCategoryName = category?.name ?? null;
          }

          if (isStillFocused) {
            setItem(loadedItem);
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
   * Confirms then removes the local photo file and SQLite item row.
   */
  function handleDeleteItemPress() {
    if (item === null) {
      return;
    }

    confirmDestructiveAction({
      title: 'Delete item?',
      message:
        'This removes the item and its local photo from this phone. Google Sheet and Drive copies are not deleted.',
      confirmLabel: 'Delete item',
      onConfirm: () => {
        void (async () => {
          setIsDeleting(true);
          setErrorMessage(null);

          try {
            await deleteLocalImageIfExists(item.localImagePath);
            await deleteItem(database, item.id);
            router.replace(`/house/${houseId}/room/${roomId}`);
          } catch (error) {
            console.log('ItemDetailScreen delete error:', error);
            setErrorMessage('Could not delete item.');
            setIsDeleting(false);
          }
        })();
      },
    });
  }

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
      {item.localImagePath !== null ? (
        <Image
          source={{ uri: item.localImagePath }}
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

      <Text style={[screenStyles.title, { color: colors.text }]}>{item.name}</Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Brand: {item.brand ?? '—'}
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Category: {categoryName ?? '—'}
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Purchase price: ${item.purchasePriceUsd.toFixed(2)}
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Purchase year: {item.purchaseYear ?? '—'}
      </Text>
      <Text style={[screenStyles.label, { color: colors.text }]}>Description</Text>
      <Text style={[{ color: colors.text, fontSize: 16, lineHeight: 22 }]}>
        {item.description ?? '—'}
      </Text>

      <Text style={[screenStyles.metaText, { color: colors.text, marginTop: 12 }]}>
        Sync: {getSyncStatusLabel(item.syncStatus)}
      </Text>

      {errorMessage !== null ? (
        <Text style={screenStyles.errorText}>{errorMessage}</Text>
      ) : null}

      <Pressable
        style={[
          screenStyles.primaryButton,
          { backgroundColor: colors.tint, opacity: isDeleting ? 0.7 : 1 },
        ]}
        disabled={isDeleting}
        onPress={() =>
          router.push(`/house/${houseId}/room/${roomId}/item/${itemId}/edit`)
        }>
        <Text style={screenStyles.primaryButtonText}>Edit Item</Text>
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        disabled={isDeleting}
        onPress={() => router.push(`/house/${houseId}/room/${roomId}`)}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Back to Room
        </Text>
      </Pressable>

      <Pressable
        style={[
          screenStyles.secondaryButton,
          { borderColor: '#b91c1c', opacity: isDeleting ? 0.7 : 1 },
        ]}
        disabled={isDeleting}
        onPress={handleDeleteItemPress}>
        {isDeleting ? (
          <ActivityIndicator color="#b91c1c" />
        ) : (
          <Text style={[screenStyles.secondaryButtonText, { color: '#b91c1c' }]}>
            Delete Item
          </Text>
        )}
      </Pressable>
    </ScrollView>
  );
}
