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
import { getHouseById } from '@/db/houses';
import {
  deletePolicy,
  getPolicyById,
  updatePolicy,
} from '@/db/insurancePolicies';
import { confirmDestructiveAction } from '@/lib/confirmDestructiveAction';
import { deleteLocalImageIfExists } from '@/lib/images';

/**
 * Edit Policy: update local fields, or delete with confirmation.
 */
export default function EditPolicyScreen() {
  const { houseId: houseIdParam, policyId: policyIdParam } = useLocalSearchParams<{
    houseId: string;
    policyId: string;
  }>();
  const houseId = Number(houseIdParam);
  const policyId = Number(policyIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [houseFolderPath, setHouseFolderPath] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [policyNumber, setPolicyNumber] = useState('');
  const [policyExpirationDate, setPolicyExpirationDate] = useState('');
  const [declarationsImagePath, setDeclarationsImagePath] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadPolicyForEdit() {
        setIsLoading(true);

        try {
          const loadedPolicy = await getPolicyById(database, policyId);
          const loadedHouse = await getHouseById(database, houseId);

          if (!isStillFocused) {
            return;
          }

          setHouseFolderPath(loadedHouse?.folderPath ?? '');

          if (loadedPolicy === null) {
            setErrorMessage('Policy not found.');
            return;
          }

          setCompanyName(loadedPolicy.companyName);
          setCompanyPhone(loadedPolicy.companyPhone ?? '');
          setPolicyNumber(loadedPolicy.policyNumber ?? '');
          setPolicyExpirationDate(loadedPolicy.policyExpirationDate ?? '');
          setDeclarationsImagePath(loadedPolicy.declarationsImagePath);
        } catch (error) {
          console.log('EditPolicyScreen load error:', error);
          if (isStillFocused) {
            setErrorMessage('Could not load policy.');
          }
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      void loadPolicyForEdit();

      return () => {
        isStillFocused = false;
      };
    }, [database, houseId, policyId]),
  );

  /**
   * Validates company name, then updates the policy row.
   */
  async function handleSavePolicy() {
    const trimmedCompanyName = companyName.trim();

    if (trimmedCompanyName.length === 0) {
      setErrorMessage('Please enter a company name.');
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updatePolicy(database, policyId, {
        companyName: trimmedCompanyName,
        companyPhone:
          companyPhone.trim().length > 0 ? companyPhone.trim() : null,
        policyNumber:
          policyNumber.trim().length > 0 ? policyNumber.trim() : null,
        policyExpirationDate:
          policyExpirationDate.trim().length > 0
            ? policyExpirationDate.trim()
            : null,
        declarationsImagePath,
      });

      router.replace(`/house/${houseId}/policies`);
    } catch (error) {
      console.log('EditPolicyScreen save error:', error);
      setErrorMessage('Could not save changes.');
      setIsSaving(false);
    }
  }

  /**
   * Confirms then removes the declarations photo and policy row.
   */
  function handleDeletePolicyPress() {
    confirmDestructiveAction({
      title: 'Delete policy?',
      message:
        'This removes the policy and its local declarations photo from this phone only.',
      confirmLabel: 'Delete policy',
      onConfirm: () => {
        void (async () => {
          setIsDeleting(true);
          setErrorMessage(null);

          try {
            await deleteLocalImageIfExists(declarationsImagePath);
            await deletePolicy(database, policyId);
            router.replace(`/house/${houseId}/policies`);
          } catch (error) {
            console.log('EditPolicyScreen delete error:', error);
            setErrorMessage('Could not delete policy.');
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
      <Text style={[screenStyles.title, { color: colors.text }]}>Edit Policy</Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Local only — not synced to Google Sheets or Drive.
      </Text>

      <ImagePickerField
        imageUri={declarationsImagePath}
        houseFolderPath={houseFolderPath}
        onImageChange={setDeclarationsImagePath}
        onError={setErrorMessage}
      />

      <Text style={[screenStyles.label, { color: colors.text }]}>
        Company Name *
      </Text>
      <FormTextInput
        value={companyName}
        onChangeText={setCompanyName}
        style={[
          screenStyles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.headerBackground,
          },
        ]}
      />

      <Text style={[screenStyles.label, { color: colors.text }]}>
        Company Phone
      </Text>
      <FormTextInput
        value={companyPhone}
        onChangeText={setCompanyPhone}
        keyboardType="phone-pad"
        style={[
          screenStyles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.headerBackground,
          },
        ]}
      />

      <Text style={[screenStyles.label, { color: colors.text }]}>
        Policy Number
      </Text>
      <FormTextInput
        value={policyNumber}
        onChangeText={setPolicyNumber}
        style={[
          screenStyles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.headerBackground,
          },
        ]}
      />

      <Text style={[screenStyles.label, { color: colors.text }]}>
        Policy Expiration Date
      </Text>
      <FormTextInput
        value={policyExpirationDate}
        onChangeText={setPolicyExpirationDate}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.border}
        style={[
          screenStyles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.headerBackground,
          },
        ]}
      />

      {errorMessage !== null ? (
        <Text style={screenStyles.errorText}>{errorMessage}</Text>
      ) : null}

      <Pressable
        style={[
          screenStyles.primaryButton,
          {
            backgroundColor: colors.tint,
            opacity: isSaving || isDeleting ? 0.7 : 1,
          },
        ]}
        disabled={isSaving || isDeleting}
        onPress={() => {
          void handleSavePolicy();
        }}>
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
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Cancel
        </Text>
      </Pressable>

      <Pressable
        style={[
          screenStyles.destructiveTextLinkWrap,
          { opacity: isSaving || isDeleting ? 0.7 : 1 },
        ]}
        disabled={isSaving || isDeleting}
        onPress={handleDeletePolicyPress}
        accessibilityRole="button"
        accessibilityLabel="Delete policy">
        {isDeleting ? (
          <ActivityIndicator color="#b91c1c" />
        ) : (
          <Text style={screenStyles.destructiveTextLink}>Delete policy</Text>
        )}
      </Pressable>
    </KeyboardAwareFormScroll>
  );
}
