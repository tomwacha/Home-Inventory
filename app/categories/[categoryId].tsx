import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
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
import { getCategoryById, updateCategoryName } from '@/db/categories';

/**
 * Edit a single category name (Feature 8).
 */
export default function EditCategoryScreen() {
  const { categoryId: categoryIdParam } = useLocalSearchParams<{ categoryId: string }>();
  const categoryId = Number(categoryIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [categoryName, setCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadCategory() {
        setIsLoading(true);

        try {
          const category = await getCategoryById(database, categoryId);
          if (isStillFocused) {
            if (category === null) {
              setErrorMessage('Category not found.');
            } else {
              setCategoryName(category.name);
            }
          }
        } catch (error) {
          console.log('EditCategoryScreen load error:', error);
          if (isStillFocused) {
            setErrorMessage('Could not load category.');
          }
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      loadCategory();

      return () => {
        isStillFocused = false;
      };
    }, [database, categoryId]),
  );

  async function handleSaveCategory() {
    const trimmedName = categoryName.trim();

    if (trimmedName.length === 0) {
      setErrorMessage('Please enter a category name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateCategoryName(database, categoryId, trimmedName);
      router.back();
    } catch (error) {
      console.log('EditCategoryScreen save error:', error);
      setErrorMessage('Could not save category. Names must be unique.');
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
    <KeyboardAvoidingView
      style={[screenStyles.container, { backgroundColor: colors.background, flex: 1 }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Edit Category</Text>

      <Text style={[screenStyles.label, { color: colors.text }]}>Category name</Text>
      <TextInput
        value={categoryName}
        onChangeText={setCategoryName}
        style={[
          screenStyles.input,
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
        onPress={handleSaveCategory}>
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
    </KeyboardAvoidingView>
  );
}
