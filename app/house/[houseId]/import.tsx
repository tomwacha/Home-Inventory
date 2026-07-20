import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getHouseById } from '@/db/houses';
import { downloadInventory, resolveGasConnection } from '@/lib/gasClient';
import { importDownloadItemsForHouse } from '@/lib/importFromGas';

/**
 * Import page: pull this house's rows from Google Sheets into local SQLite.
 * Merge-in only — does not delete phone-only items.
 */
export default function ImportScreen() {
  const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
  const houseId = Number(houseIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Downloads Sheet rows for this house name and upserts them locally.
   */
  async function handleImportFromSheets() {
    if (Number.isNaN(houseId)) {
      setErrorMessage('Invalid house id.');
      return;
    }

    setIsImporting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const house = await getHouseById(database, houseId);

      if (house === null) {
        setErrorMessage('House not found.');
        return;
      }

      setStatusMessage('Connecting to Google Apps Script…');
      const connection = await resolveGasConnection(database);

      setStatusMessage(`Downloading “${house.name}” from Google Sheets…`);
      const downloadResponse = await downloadInventory(
        connection.webAppUrl,
        house.name,
      );

      if (downloadResponse.items.length === 0) {
        setStatusMessage(
          `No Sheet rows found for house “${house.name}”. Check the house_name column matches exactly.`,
        );
        return;
      }

      setStatusMessage(
        `Importing ${downloadResponse.items.length} row(s) and photos…`,
      );
      const summary = await importDownloadItemsForHouse(
        database,
        house,
        downloadResponse.items,
      );

      setStatusMessage(
        `Import finished. Created ${summary.createdCount}, updated ${summary.updatedCount}, skipped ${summary.skippedCount}.`,
      );
    } catch (error) {
      console.log('ImportScreen import error:', error);
      const message =
        error instanceof Error
          ? error.message
          : 'Could not import from Google Sheets.';
      setErrorMessage(message);
      setStatusMessage(null);
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Import</Text>
      <Text style={[screenStyles.subtitle, { color: colors.text }]}>
        Pull inventory rows for this house from your Google Sheet. Existing local
        items are updated; phone-only items are kept.
      </Text>

      {statusMessage !== null ? (
        <Text style={[screenStyles.metaText, { color: colors.text, marginTop: 12 }]}>
          {statusMessage}
        </Text>
      ) : null}

      {errorMessage !== null ? (
        <Text style={screenStyles.errorText}>{errorMessage}</Text>
      ) : null}

      <Pressable
        style={[
          screenStyles.primaryButton,
          { backgroundColor: colors.tint, opacity: isImporting ? 0.7 : 1 },
        ]}
        disabled={isImporting}
        onPress={() => {
          void handleImportFromSheets();
        }}>
        {isImporting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={screenStyles.primaryButtonText}>Import from Sheets</Text>
        )}
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        disabled={isImporting}
        onPress={() => router.push('/settings')}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Open Settings
        </Text>
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        disabled={isImporting}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Back
        </Text>
      </Pressable>
    </View>
  );
}
