import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';

/**
 * Export page stub (Feature 9). PDF/Sheets wiring is Milestone 2–3.
 */
export default function ExportScreen() {
  const { houseId } = useLocalSearchParams<{ houseId: string }>();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const router = useRouter();

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Export</Text>
      <Text style={[screenStyles.subtitle, { color: colors.text }]}>
        PDF and Google Sheets export will be built in later milestones. House id: {houseId}
      </Text>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Back</Text>
      </Pressable>
    </View>
  );
}
