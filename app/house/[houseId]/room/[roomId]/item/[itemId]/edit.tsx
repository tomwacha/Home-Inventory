import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import CategoryDropdown from '@/components/CategoryDropdown';
import ItemPhotoStrip from '@/components/ItemPhotoStrip';
import KeyboardAwareFormScroll, {
  FormTextInput,
} from '@/components/KeyboardAwareFormScroll';
import RoomDropdown from '@/components/RoomDropdown';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getAllCategories } from '@/db/categories';
import { getHouseById } from '@/db/houses';
import { getImagesByItemId } from '@/db/itemImages';
import { deleteItem, getItemById, updateItem } from '@/db/items';
import { getRoomsByHouseId } from '@/db/rooms';
import { confirmDestructiveAction } from '@/lib/confirmDestructiveAction';
import {
  isValidOptionalYyyyMmDd,
  normalizeOptionalYyyyMmDd,
} from '@/lib/dateText';
import { deleteLocalImageIfExists } from '@/lib/images';
import {
  persistDraftItemPhotos,
  type DraftItemPhoto,
} from '@/lib/persistItemPhotos';
import type { Category, Room } from '@/types/inventory';

/**
 * Edit Item form (Feature 6) with multi-photo replace/remove and room switch.
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState(roomId);
  // SQLite room_id currently on the item (ignore unsaved picker changes on Delete).
  const [savedRoomId, setSavedRoomId] = useState(roomId);
  const [houseName, setHouseName] = useState('');
  const [houseFolderPath, setHouseFolderPath] = useState('');
  const [itemName, setItemName] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [purchasePriceText, setPurchasePriceText] = useState('');
  const [purchaseDateText, setPurchaseDateText] = useState('');
  const [description, setDescription] = useState('');
  const [photoDrafts, setPhotoDrafts] = useState<DraftItemPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadItemForEdit() {
        setIsLoading(true);

        try {
          const loadedItem = await getItemById(database, itemId);
          const loadedCategories = await getAllCategories(database);
          const loadedRooms = await getRoomsByHouseId(database, houseId);
          const loadedHouse = await getHouseById(database, houseId);
          const loadedImages = await getImagesByItemId(database, itemId);

          if (!isStillFocused) {
            return;
          }

          setCategories(loadedCategories);
          setRooms(loadedRooms);
          setHouseName(loadedHouse?.name ?? '');
          setHouseFolderPath(loadedHouse?.folderPath ?? '');

          if (loadedItem === null) {
            setErrorMessage('Item not found.');
            return;
          }

          setSelectedRoomId(loadedItem.roomId);
          setSavedRoomId(loadedItem.roomId);
          setItemName(loadedItem.name);
          setBrand(loadedItem.brand ?? '');
          setModel(loadedItem.model ?? '');
          setSelectedCategoryId(loadedItem.categoryId);
          setPurchasePriceText(String(loadedItem.purchasePriceUsd));
          setPurchaseDateText(loadedItem.purchaseDate ?? '');
          setDescription(loadedItem.description ?? '');

          // Fall back to denormalized primary when migration/backfill missed a row.
          if (loadedImages.length > 0) {
            setPhotoDrafts(
              loadedImages.map((itemImage) => ({
                clientKey: `image-${itemImage.id}`,
                imageId: itemImage.id,
                localPath: itemImage.localPath ?? '',
                driveImageUrl: itemImage.driveImageUrl,
                isPrimary: itemImage.isPrimary,
                needsFinalize: false,
              })).filter((draft) => draft.localPath.length > 0),
            );
          } else if (loadedItem.localImagePath !== null) {
            setPhotoDrafts([
              {
                clientKey: `legacy-primary-${loadedItem.id}`,
                imageId: null,
                localPath: loadedItem.localImagePath,
                driveImageUrl: loadedItem.driveImageUrl,
                isPrimary: true,
                needsFinalize: true,
              },
            ]);
          } else {
            setPhotoDrafts([]);
          }
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

    if (Number.isNaN(purchasePriceUsd)) {
      setErrorMessage('Purchase price must be a number.');
      return;
    }

    if (!isValidOptionalYyyyMmDd(purchaseDateText)) {
      setErrorMessage('Purchase date must be YYYY-MM-DD.');
      return;
    }

    // Room is required — refuse save if the picker somehow has no valid id.
    if (Number.isNaN(selectedRoomId) || selectedRoomId <= 0) {
      setErrorMessage('Please select a room.');
      return;
    }

    const purchaseDate = normalizeOptionalYyyyMmDd(purchaseDateText);
    const primaryDraft =
      photoDrafts.find((draft) => draft.isPrimary) ?? photoDrafts[0] ?? null;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updateItem(database, itemId, {
        roomId: selectedRoomId,
        name: trimmedItemName,
        brand: brand.trim().length > 0 ? brand.trim() : null,
        model: model.trim().length > 0 ? model.trim() : null,
        categoryId: selectedCategoryId,
        purchasePriceUsd,
        purchaseDate,
        description: description.trim().length > 0 ? description.trim() : null,
        localImagePath: primaryDraft?.localPath ?? null,
      });

      await persistDraftItemPhotos({
        database,
        itemId,
        houseName,
        itemName: trimmedItemName,
        houseFolderPath,
        drafts: photoDrafts,
      });

      // Always land on detail under the saved room so URLs match SQLite after a switch.
      router.replace(`/house/${houseId}/room/${selectedRoomId}/item/${itemId}`);
    } catch (error) {
      console.log('EditItemScreen save error:', error);
      setErrorMessage('Could not save changes.');
      setIsSaving(false);
    }
  }

  /**
   * Confirms then removes all local photo files and the SQLite item row.
   */
  function handleDeleteItemPress() {
    confirmDestructiveAction({
      title: 'Delete item?',
      message:
        'This removes the item and its local photos from this phone. Google Sheet and Drive copies are not deleted.',
      confirmLabel: 'Delete item',
      onConfirm: () => {
        void (async () => {
          setIsDeleting(true);
          setErrorMessage(null);

          try {
            for (const draft of photoDrafts) {
              await deleteLocalImageIfExists(draft.localPath);
            }

            await deleteItem(database, itemId);
            router.replace(`/house/${houseId}/room/${savedRoomId}`);
          } catch (error) {
            console.log('EditItemScreen delete error:', error);
            setErrorMessage('Could not delete item.');
            setIsDeleting(false);
          }
        })();
      },
    });
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

        <ItemPhotoStrip
          drafts={photoDrafts}
          houseFolderPath={houseFolderPath}
          onDraftsChange={setPhotoDrafts}
          onError={setErrorMessage}
          disabled={isSaving || isDeleting}
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

        <Text style={[screenStyles.label, { color: colors.text }]}>Room *</Text>
        <RoomDropdown
          rooms={rooms}
          selectedRoomId={selectedRoomId}
          onSelectRoomId={setSelectedRoomId}
          disabled={isSaving || isDeleting}
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
          disabled={isSaving || isDeleting}
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
            { backgroundColor: colors.tint, opacity: isSaving || isDeleting ? 0.7 : 1 },
          ]}
          disabled={isSaving || isDeleting}
          onPress={handleSaveItem}>
          {isSaving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={screenStyles.primaryButtonText}>Save</Text>
          )}
        </Pressable>

        <Pressable
          style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
          disabled={isSaving || isDeleting}
          onPress={() => router.back()}>
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[
            screenStyles.destructiveTextLinkWrap,
            { opacity: isSaving || isDeleting ? 0.7 : 1 },
          ]}
          disabled={isSaving || isDeleting}
          onPress={handleDeleteItemPress}
          accessibilityRole="button"
          accessibilityLabel="Delete item">
          {isDeleting ? (
            <ActivityIndicator color="#b91c1c" />
          ) : (
            <Text style={screenStyles.destructiveTextLink}>Delete item</Text>
          )}
        </Pressable>
    </KeyboardAwareFormScroll>
  );
}
