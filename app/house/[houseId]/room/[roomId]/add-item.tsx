import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getAllCategories } from '@/db/categories';
import { createItem } from '@/db/items';
import type { Category } from '@/types/inventory';

/**
 * Add Item form (Feature 7). Photo capture comes in Milestone 2.
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
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [purchasePriceText, setPurchasePriceText] = useState('');
  const [purchaseYearText, setPurchaseYearText] = useState('');
  const [description, setDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadCategories() {
        try {
          const loadedCategories = await getAllCategories(database);
          if (isStillFocused) {
            setCategories(loadedCategories);
          }
        } catch (error) {
          console.log('AddItemScreen category load error:', error);
        }
      }

      loadCategories();

      return () => {
        isStillFocused = false;
      };
    }, [database]),
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
      });

      router.replace(`/house/${houseId}/room/${roomId}/item/${createdItem.id}`);
    } catch (error) {
      console.log('AddItemScreen save error:', error);
      setErrorMessage('Could not save the item.');
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={screenStyles.container}>
        <Text style={[screenStyles.title, { color: colors.text }]}>Add Item</Text>

        <View
          style={[
            screenStyles.secondaryButton,
            { borderColor: colors.border, marginTop: 0, paddingVertical: 40 },
          ]}>
          <Text style={[screenStyles.metaText, { color: colors.text, textAlign: 'center' }]}>
            Photo placeholder — camera/gallery arrives in Milestone 2.
          </Text>
        </View>

        <Text style={[screenStyles.label, { color: colors.text }]}>Name</Text>
        <TextInput
          value={itemName}
          onChangeText={setItemName}
          style={[
            screenStyles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
          ]}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Brand</Text>
        <TextInput
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
        <TextInput
          value={purchasePriceText}
          onChangeText={setPurchasePriceText}
          keyboardType="decimal-pad"
          style={[
            screenStyles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
          ]}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Purchase year</Text>
        <TextInput
          value={purchaseYearText}
          onChangeText={setPurchaseYearText}
          keyboardType="number-pad"
          style={[
            screenStyles.input,
            { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
          ]}
        />

        <Text style={[screenStyles.label, { color: colors.text }]}>Description</Text>
        <TextInput
          value={description}
          onChangeText={setDescription}
          multiline
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
