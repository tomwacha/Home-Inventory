import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';

import ImagePickerField from '@/components/ImagePickerField';
import KeyboardAwareFormScroll, {
  FormTextInput,
} from '@/components/KeyboardAwareFormScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getHouseById } from '@/db/houses';
import { createPolicy } from '@/db/insurancePolicies';

/**
 * Add Policy form for one house (local-only insurance details).
 */
export default function AddPolicyScreen() {
  const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
  const houseId = Number(houseIdParam);

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
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadHouseFolder() {
        try {
          const loadedHouse = await getHouseById(database, houseId);

          if (isStillFocused) {
            setHouseFolderPath(loadedHouse?.folderPath ?? '');
          }
        } catch (error) {
          console.log('AddPolicyScreen house load error:', error);
        }
      }

      void loadHouseFolder();

      return () => {
        isStillFocused = false;
      };
    }, [database, houseId]),
  );

  /**
   * Validates company name, then inserts a policy row for this house.
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
      await createPolicy(database, {
        houseId,
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
      console.log('AddPolicyScreen save error:', error);
      setErrorMessage('Could not save the policy.');
      setIsSaving(false);
    }
  }

  return (
    <KeyboardAwareFormScroll backgroundColor={colors.background}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Add Policy</Text>
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
          { backgroundColor: colors.tint, opacity: isSaving ? 0.7 : 1 },
        ]}
        disabled={isSaving}
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
        disabled={isSaving}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Cancel
        </Text>
      </Pressable>
    </KeyboardAwareFormScroll>
  );
}
