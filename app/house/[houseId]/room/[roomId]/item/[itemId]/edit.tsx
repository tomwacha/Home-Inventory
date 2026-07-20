import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import ImagePickerField from '@/components/ImagePickerField';
import KeyboardAwareFormScroll, {
  FormTextInput,
} from '@/components/KeyboardAwareFormScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getAllCategories } from '@/db/categories';
import { getHouseById } from '@/db/houses';
import { getItemById, updateItem } from '@/db/items';
import type { Category } from '@/types/inventory';

/**
 * Edit Item form (Feature 6) with photo replace/remove (Feature 11).
 */
export default function EditItemScreen() {
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

  const [categories, setCategories] = useState<Category[]>([]);
  const [houseFolderPath, setHouseFolderPath] = useState('');
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [purchasePriceText, setPurchasePriceText] = useState('');
  const [purchaseYearText, setPurchaseYearText] = useState('');
  const [description, setDescription] = useState('');
  const [localImagePath, setLocalImagePath] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadItemForEdit() {
        setIsLoading(true);

        try {
          const loadedItem = await getItemById(database, itemId);
          const loadedCategories = await getAllCategories(database);
          const loadedHouse = await getHouseById(database, houseId);

          if (!isStillFocused) {
            return;
          }

          setCategories(loadedCategories);
          setHouseFolderPath(loadedHouse?.folderPath ?? '');

          if (loadedItem === null) {
            setErrorMessage('Item not found.');
            return;
          }

          setItemName(loadedItem.name);
          setBrand(loadedItem.brand ?? '');
          setSelectedCategoryId(loadedItem.categoryId);
          setPurchasePriceText(String(loadedItem.purchasePriceUsd));
          setPurchaseYearText(
            loadedItem.purchaseYear !== null ? String(loadedItem.purchaseYear) : '',
          );
          setDescription(loadedItem.description ?? '');
          setLocalImagePath(loadedItem.localImagePath);
        } catch (error) {
          console.log('EditItemScreen load error:', error);
          if (isStillFocused) {
            setErrorMessage('Could not load item.');
          }
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      loadItemForEdit();

      return () => {
        isStillFocused = false;
      };
    }, [database, houseId, itemId]),
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

    if (Number.isNaN(purchasePriceUsd)) {
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
      await updateItem(database, itemId, {
        name: trimmedItemName,
        brand: brand.trim().length > 0 ? brand.trim() : null,
        categoryId: selectedCategoryId,
        purchasePriceUsd,
        purchaseYear,
        description: description.trim().length > 0 ? description.trim() : null,
        localImagePath,
      });

      router.replace(`/house/${houseId}/room/${roomId}/item/${itemId}`);
    } catch (error) {
      console.log('EditItemScreen save error:', error);
      setErrorMessage('Could not save changes.');
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <KeyboardAwareFormScroll backgroundColor={colors.background}>
        <Text style={[screenStyles.title, { color: colors.text }]}>Edit Item</Text>

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
        <Pressable
          style={[screenStyles.rowButton, { borderColor: colors.border }]}
          onPress={() => setSelectedCategoryId(null)}>
          <Text style={{ color: colors.text }}>
            {selectedCategoryId === null ? '✓ None' : 'None'}
          </Text>
        </Pressable>
        {categories.map((category) => (
          <Pressable
            key={category.id}
            style={[screenStyles.rowButton, { borderColor: colors.border }]}
            onPress={() => setSelectedCategoryId(category.id)}>
            <Text style={{ color: colors.text }}>
              {selectedCategoryId === category.id ? `✓ ${category.name}` : category.name}
            </Text>
          </Pressable>
        ))}
        <Pressable
          style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
          onPress={() => router.push('/categories')}>
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
            New / manage categories
          </Text>
        </Pressable>

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
