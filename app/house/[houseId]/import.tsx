import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';

/**
 * Import page stub (Feature 10). Google Sheets import is Milestone 3.
 */
export default function ImportScreen() {
  const { houseId } = useLocalSearchParams<{ houseId: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Import</Text>
      <Text style={[screenStyles.subtitle, { color: colors.text }]}>
        Importing from Google Sheets arrives in Milestone 3. House id: {houseId}
      </Text>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Back</Text>
      </Pressable>
    </View>
  );
}
