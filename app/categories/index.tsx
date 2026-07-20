import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { createCategory, getAllCategories } from '@/db/categories';
import type { Category } from '@/types/inventory';

/**
 * Category list + add form (Feature 8).
 */
export default function CategoriesScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [categories, setCategories] = useState<Category[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const reloadCategories = useCallback(async () => {
    const loadedCategories = await getAllCategories(database);
    setCategories(loadedCategories);
  }, [database]);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadCategories() {
        setIsLoading(true);
        try {
          await reloadCategories();
        } catch (error) {
          console.log('CategoriesScreen load error:', error);
          if (isStillFocused) {
            setErrorMessage('Could not load categories.');
          }
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      loadCategories();

      return () => {
        isStillFocused = false;
      };
    }, [reloadCategories]),
  );

  async function handleAddCategory() {
    const trimmedName = newCategoryName.trim();

    if (trimmedName.length === 0) {
      setErrorMessage('Please enter a category name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await createCategory(database, { name: trimmedName });
      setNewCategoryName('');
      await reloadCategories();
    } catch (error) {
      console.log('CategoriesScreen add error:', error);
      setErrorMessage('Could not add category. Names must be unique.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[screenStyles.container, { backgroundColor: colors.background, flex: 1 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Categories</Text>
      <Text style={[screenStyles.subtitle, { color: colors.text }]}>
        Categories are shared across every house.
      </Text>

      <Text style={[screenStyles.label, { color: colors.text }]}>Add category *</Text>
      <TextInput
        value={newCategoryName}
        onChangeText={setNewCategoryName}
        placeholder="e.g. Electronics"
        placeholderTextColor={colors.border}
        style={[
          screenStyles.input,
          { color: colors.text, borderColor: colors.border, backgroundColor: colors.headerBackground },
        ]}
      />

      <Pressable
        style={[
          screenStyles.primaryButton,
          { backgroundColor: colors.tint, opacity: isSaving ? 0.7 : 1 },
        ]}
        disabled={isSaving}
        onPress={handleAddCategory}>
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={screenStyles.primaryButtonText}>Add</Text>
        )}
      </Pressable>

      {errorMessage !== null ? (
        <Text style={screenStyles.errorText}>{errorMessage}</Text>
      ) : null}

      {isLoading ? <ActivityIndicator style={{ marginTop: 16 }} /> : null}

      <FlatList
        data={categories}
        keyExtractor={(category) => String(category.id)}
        style={{ marginTop: 16 }}
        ListEmptyComponent={
          !isLoading ? (
            <Text style={[screenStyles.emptyText, { color: colors.text }]}>
              No categories yet.
            </Text>
          ) : null
        }
        renderItem={({ item }) => (
          <Pressable
            style={[screenStyles.rowButton, { borderColor: colors.border }]}
            onPress={() => router.push(`/categories/${item.id}`)}>
            <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
              {item.name}
            </Text>
          </Pressable>
        )}
      />

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Back</Text>
      </Pressable>
    </KeyboardAvoidingView>
  );
}
