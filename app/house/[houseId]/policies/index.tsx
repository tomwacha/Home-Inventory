import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getHouseById } from '@/db/houses';
import { getPoliciesByHouseId } from '@/db/insurancePolicies';
import type { House, HouseInsurancePolicy } from '@/types/inventory';

/**
 * Lists insurance policies for one house (local-only; not cloud synced).
 */
export default function InsurancePoliciesScreen() {
  const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
  const houseId = Number(houseIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [house, setHouse] = useState<House | null>(null);
  const [policies, setPolicies] = useState<HouseInsurancePolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let isStillFocused = true;

      async function loadPolicies() {
        if (Number.isNaN(houseId)) {
          setErrorMessage('Invalid house id.');
          setIsLoading(false);
          return;
        }

        setIsLoading(true);
        setErrorMessage(null);

        try {
          const loadedHouse = await getHouseById(database, houseId);
          const loadedPolicies = await getPoliciesByHouseId(database, houseId);

          if (isStillFocused) {
            setHouse(loadedHouse);
            setPolicies(loadedPolicies);
          }
        } catch (error) {
          console.log('InsurancePoliciesScreen load error:', error);
          if (isStillFocused) {
            setErrorMessage('Could not load policies.');
          }
        } finally {
          if (isStillFocused) {
            setIsLoading(false);
          }
        }
      }

      void loadPolicies();

      return () => {
        isStillFocused = false;
      };
    }, [database, houseId]),
  );

  if (isLoading) {
    return (
      <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[screenStyles.title, { color: colors.text }]}>
        {house !== null ? `${house.name} Policies` : 'Insurance Policies'}
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text }]}>
        Stored only on this phone. Policies are not uploaded to Google Sheets or
        Drive.
      </Text>

      {errorMessage !== null ? (
        <Text style={screenStyles.errorText}>{errorMessage}</Text>
      ) : null}

      <Pressable
        style={[screenStyles.primaryButton, { backgroundColor: colors.tint }]}
        onPress={() => router.push(`/house/${houseId}/policies/add`)}>
        <Text style={screenStyles.primaryButtonText}>Add Policy</Text>
      </Pressable>

      <Text style={[screenStyles.label, { color: colors.text }]}>Policies</Text>

      <FlatList
        data={policies}
        keyExtractor={(policy) => String(policy.id)}
        ListEmptyComponent={
          <Text style={[screenStyles.emptyText, { color: colors.text }]}>
            No policies yet. Tap Add Policy to store one for this house.
          </Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[screenStyles.rowButton, { borderColor: colors.border }]}
            onPress={() =>
              router.push(`/house/${houseId}/policies/${item.id}/edit`)
            }>
            <View>
              <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
                {item.companyName}
              </Text>
              <Text style={[screenStyles.metaText, { color: colors.text }]}>
                {item.policyNumber !== null && item.policyNumber.length > 0
                  ? item.policyNumber
                  : 'No policy number'}
              </Text>
            </View>
            <Text style={[screenStyles.metaText, { color: colors.text }]}>Edit</Text>
          </Pressable>
        )}
      />

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Back to House
        </Text>
      </Pressable>
    </View>
  );
}
