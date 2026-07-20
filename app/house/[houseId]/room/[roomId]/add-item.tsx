import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import ImagePickerField from '@/components/ImagePickerField';
import CategoryDropdown from '@/components/CategoryDropdown';
import KeyboardAwareFormScroll, {
  FormTextInput,
} from '@/components/KeyboardAwareFormScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getAllCategories } from '@/db/categories';
import { getHouseById } from '@/db/houses';
import { createItem } from '@/db/items';
import type { Category } from '@/types/inventory';

/**
 * Add Item form (Feature 7) with camera/gallery photo capture (Feature 11).
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
  const [houseFolderPath, setHouseFolderPath] = useState('');
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [purchasePriceText, setPurchasePriceText] = useState('');
  const [purchaseYearText, setPurchaseYearText] = useState('');
  const [description, setDescription] = useState('');
  const [localImagePath, setLocalImagePath] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadCategoriesAndHouseFolder() {
        try {
          const loadedCategories = await getAllCategories(database);
          const loadedHouse = await getHouseById(database, houseId);

          if (isStillFocused) {
            setCategories(loadedCategories);
            setHouseFolderPath(loadedHouse?.folderPath ?? '');
          }
        } catch (error) {
          console.log('AddItemScreen category load error:', error);
        }
      }

      loadCategoriesAndHouseFolder();

      return () => {
        isStillFocused = false;
      };
    }, [database, houseId]),
  );

  async function handleSaveItem() {
    const trimmedItemName = itemName.trim();

    if (trimmedItemName.length === 0) {
      setErrorMessage('Please enter an item name.');
      return;
    }

    const purchasePriceUsd = Number(purchasePriceText);
    const purchaseYear =
      purchaseYearText.trim().length === 0 ? null : Number(purchaseYearText);

    if (purchasePriceText.trim().length > 0 && Number.isNaN(purchasePriceUsd)) {
      setErrorMessage('Purchase price must be a number.');
      return;
    }

    if (purchaseYear !== null && Number.isNaN(purchaseYear)) {
      setErrorMessage('Purchase year must be a number.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const createdItem = await createItem(database, {
        roomId,
        name: trimmedItemName,
        brand: brand.trim().length > 0 ? brand.trim() : null,
        categoryId: selectedCategoryId,
        purchasePriceUsd: purchasePriceText.trim().length > 0 ? purchasePriceUsd : 0,
        purchaseYear,
        description: description.trim().length > 0 ? description.trim() : null,
        localImagePath,
      });

      router.replace(`/house/${houseId}/room/${roomId}/item/${createdItem.id}`);
    } catch (error) {
      console.log('AddItemScreen save error:', error);
      setErrorMessage('Could not save the item.');
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAwareFormScroll backgroundColor={colors.background}>
        <Text style={[screenStyles.title, { color: colors.text }]}>Add Item</Text>

        <ImagePickerField
          imageUri={localImagePath}
          houseFolderPath={houseFolderPath}
          onImageChange={setLocalImagePath}
          onError={setErrorMessage}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Name</Text>
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

        <Text style={[screenStyles.label, { color: colors.text }]}>Purchase year</Text>
        <FormTextInput
          value={purchaseYearText}
          onChangeText={setPurchaseYearText}
          keyboardType="number-pad"
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
          onPress={() => router.back()}>
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
        </Pressable>
    </KeyboardAwareFormScroll>
  );
}
