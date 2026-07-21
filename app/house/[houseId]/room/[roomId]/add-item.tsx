import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import CategoryDropdown from '@/components/CategoryDropdown';
import ItemPhotoStrip from '@/components/ItemPhotoStrip';
import KeyboardAwareFormScroll, {
  FormTextInput,
} from '@/components/KeyboardAwareFormScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getAllCategories } from '@/db/categories';
import { getHouseById } from '@/db/houses';
import { createItem } from '@/db/items';
import { getRoomById } from '@/db/rooms';
import {
  isValidOptionalYyyyMmDd,
  normalizeOptionalYyyyMmDd,
} from '@/lib/dateText';
import { deleteLocalImageIfExists } from '@/lib/images';
import {
  persistDraftItemPhotos,
  type DraftItemPhoto,
} from '@/lib/persistItemPhotos';
import type { Category } from '@/types/inventory';

/**
 * Add Item form (Feature 7) with multi-photo capture (primary + strip).
 */
export default function AddItemScreen() {
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

  const [categories, setCategories] = useState<Category[]>([]);
  const [houseName, setHouseName] = useState('');
  const [houseFolderPath, setHouseFolderPath] = useState('');
  const [roomName, setRoomName] = useState<string | null>(null);
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [purchasePriceText, setPurchasePriceText] = useState('');
  const [purchaseDateText, setPurchaseDateText] = useState('');
  const [description, setDescription] = useState('');
  const [photoDrafts, setPhotoDrafts] = useState<DraftItemPhoto[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadCategoriesAndHouseFolder() {
        try {
          const loadedCategories = await getAllCategories(database);
          const loadedHouse = await getHouseById(database, houseId);
          const loadedRoom = await getRoomById(database, roomId);

          if (isStillFocused) {
            setCategories(loadedCategories);
            setHouseName(loadedHouse?.name ?? '');
            setHouseFolderPath(loadedHouse?.folderPath ?? '');
            setRoomName(loadedRoom?.name ?? null);
          }
        } catch (error) {
          console.log('AddItemScreen category load error:', error);
        }
      }

      loadCategoriesAndHouseFolder();

      return () => {
        isStillFocused = false;
      };
    }, [database, houseId, roomId]),
  );

  async function handleSaveItem() {
    const trimmedItemName = itemName.trim();

    if (trimmedItemName.length === 0) {
      setErrorMessage('Please enter an item name.');
      return;
    }

    const purchasePriceUsd = Number(purchasePriceText);

    if (purchasePriceText.trim().length > 0 && Number.isNaN(purchasePriceUsd)) {
      setErrorMessage('Purchase price must be a number.');
      return;
    }

    if (!isValidOptionalYyyyMmDd(purchaseDateText)) {
      setErrorMessage('Purchase date must be YYYY-MM-DD.');
      return;
    }

    const purchaseDate = normalizeOptionalYyyyMmDd(purchaseDateText);

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const primaryDraft =
        photoDrafts.find((draft) => draft.isPrimary) ?? photoDrafts[0] ?? null;

      const createdItem = await createItem(database, {
        roomId,
        name: trimmedItemName,
        brand: brand.trim().length > 0 ? brand.trim() : null,
        model: model.trim().length > 0 ? model.trim() : null,
        categoryId: selectedCategoryId,
        purchasePriceUsd: purchasePriceText.trim().length > 0 ? purchasePriceUsd : 0,
        purchaseDate,
        description: description.trim().length > 0 ? description.trim() : null,
        localImagePath: primaryDraft?.localPath ?? null,
      });

      await persistDraftItemPhotos({
        database,
        itemId: createdItem.id,
        houseName,
        itemName: trimmedItemName,
        houseFolderPath,
        drafts: photoDrafts,
      });

      router.replace(`/house/${houseId}/room/${roomId}/item/${createdItem.id}`);
    } catch (error) {
      console.log('AddItemScreen save error:', error);
      setErrorMessage('Could not save the item.');
      setIsSaving(false);
    }
  }

  /**
   * Leaves the screen and deletes any staged photos that were never saved.
   */
  async function handleCancel() {
    for (const draft of photoDrafts) {
      if (draft.needsFinalize) {
        await deleteLocalImageIfExists(draft.localPath);
      }
    }

    router.back();
  }

  return (
    <KeyboardAwareFormScroll backgroundColor={colors.background}>
        <Text style={[screenStyles.title, { color: colors.text }]}>
          {roomName !== null ? `Add Item to ${roomName}` : 'Add Item'}
        </Text>

        <ItemPhotoStrip
          drafts={photoDrafts}
          houseFolderPath={houseFolderPath}
          onDraftsChange={setPhotoDrafts}
          onError={setErrorMessage}
          disabled={isSaving}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Name *</Text>
        <FormTextInput
          value={itemName}
          onChangeText={setItemName}
          style={[
            screenStyles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
          ]}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Brand</Text>
        <FormTextInput
          value={brand}
          onChangeText={setBrand}
          style={[
            screenStyles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
          ]}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Model</Text>
        <FormTextInput
          value={model}
          onChangeText={setModel}
          style={[
            screenStyles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
          ]}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Category</Text>
        <CategoryDropdown
          categories={categories}
          selectedCategoryId={selectedCategoryId}
          onSelectCategoryId={setSelectedCategoryId}
          onPressManageCategories={() => router.push('/categories')}
          disabled={isSaving}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Purchase price (USD)</Text>
        <FormTextInput
          value={purchasePriceText}
          onChangeText={setPurchasePriceText}
          keyboardType="decimal-pad"
          style={[
            screenStyles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
          ]}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Purchase date</Text>
        <FormTextInput
          value={purchaseDateText}
          onChangeText={setPurchaseDateText}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={colors.border}
          autoCapitalize="none"
          autoCorrect={false}
          style={[
            screenStyles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
          ]}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Description</Text>
        <FormTextInput
          value={description}
          onChangeText={setDescription}
          multiline
          scrollEnabled
          style={[
            screenStyles.input,
            screenStyles.textArea,
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
          onPress={handleSaveItem}>
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={screenStyles.primaryButtonText}>Save</Text>
          )}
        </Pressable>

        <Pressable
          style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
          disabled={isSaving}
          onPress={() => {
            void handleCancel();
          }}>
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
        </Pressable>
    </KeyboardAwareFormScroll>
  );
}
