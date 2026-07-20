import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getHouseById } from '@/db/houses';
import { getExportRowsForHouse } from '@/db/items';
import {
  createAndShareInventoryExport,
  type InventoryExportFormat,
} from '@/lib/shareInventoryExport';

/**
 * Export page (Feature 9 / 13): local PDF or CSV via the system share sheet.
 * Google Sheets export stays in Milestone 3.
 */
export default function ExportScreen() {
  const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
  const houseId = Number(houseIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [selectedFormat, setSelectedFormat] = useState<InventoryExportFormat>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Loads house items, builds the chosen file, and opens the share sheet.
   */
  async function handleExport() {
    if (Number.isNaN(houseId)) {
      setErrorMessage('Invalid house id.');
      return;
    }

    setIsExporting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const house = await getHouseById(database, houseId);

      if (house === null) {
        setErrorMessage('House not found.');
        return;
      }

      const exportRows = await getExportRowsForHouse(database, houseId);

      if (exportRows.length === 0) {
        setErrorMessage('This house has no items to export yet.');
        return;
      }

      setStatusMessage(
        selectedFormat === 'pdf'
          ? 'Building PDF with photos…'
          : 'Building CSV…',
      );

      await createAndShareInventoryExport({
        format: selectedFormat,
        houseName: house.name,
        rows: exportRows,
      });

      setStatusMessage('Share sheet opened. Pick an app to save or send the file.');
    } catch (error) {
      console.log('ExportScreen export error:', error);
      const message =
        error instanceof Error ? error.message : 'Could not export the inventory.';
      setErrorMessage(message);
      setStatusMessage(null);
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Export</Text>
      <Text style={[screenStyles.subtitle, { color: colors.text }]}>
        Create a local PDF (with photos) or CSV, then share it with email, Drive, or Files.
        Google Sheets export comes in Milestone 3.
      </Text>

      <Text style={[screenStyles.label, { color: colors.text }]}>Format</Text>

      <Pressable
        style={[
          screenStyles.rowButton,
          {
            borderColor: colors.border,
            backgroundColor:
              selectedFormat === 'pdf' ? colors.headerBackground : 'transparent',
          },
        ]}
        disabled={isExporting}
        onPress={() => setSelectedFormat('pdf')}>
        <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
          {selectedFormat === 'pdf' ? '✓ PDF (details + photos)' : 'PDF (details + photos)'}
        </Text>
      </Pressable>

      <Pressable
        style={[
          screenStyles.rowButton,
          {
            borderColor: colors.border,
            backgroundColor:
              selectedFormat === 'csv' ? colors.headerBackground : 'transparent',
          },
        ]}
        disabled={isExporting}
        onPress={() => setSelectedFormat('csv')}>
        <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
          {selectedFormat === 'csv' ? '✓ CSV (spreadsheet text)' : 'CSV (spreadsheet text)'}
        </Text>
      </Pressable>

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
          { backgroundColor: colors.tint, opacity: isExporting ? 0.7 : 1 },
        ]}
        disabled={isExporting}
        onPress={handleExport}>
        {isExporting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={screenStyles.primaryButtonText}>Export & Share</Text>
        )}
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        disabled={isExporting}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>Back</Text>
      </Pressable>
    </View>
  );
}
