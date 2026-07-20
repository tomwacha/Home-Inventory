import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';

import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getHouseById } from '@/db/houses';
import { getExportRowsForHouse, getSyncRowsForHouse, markItemsSyncedFromUploadResults } from '@/db/items';
import { buildGasUploadItems } from '@/lib/buildGasUploadItems';
import {
  checkDuplicates,
  resolveGasConnection,
  uploadInventory,
} from '@/lib/gasClient';
import {
  createAndShareInventoryExport,
  type InventoryExportFormat,
} from '@/lib/shareInventoryExport';
import type { GasDuplicateMode, GasUploadItem } from '@/types/gasSync';

type ExportDestination = InventoryExportFormat | 'sheets';

/**
 * Export page: local PDF/CSV share, or upload this house to Google Sheets.
 */
export default function ExportScreen() {
  const { houseId: houseIdParam } = useLocalSearchParams<{ houseId: string }>();
  const houseId = Number(houseIdParam);

  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();

  const [selectedDestination, setSelectedDestination] =
    useState<ExportDestination>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Runs the Google Sheets upload after the user picks skip or override.
   */
  async function runSheetsUpload(
    webAppUrl: string,
    driveFolderId: string | null,
    uploadItems: GasUploadItem[],
    duplicateMode: GasDuplicateMode,
  ) {
    setStatusMessage(
      duplicateMode === 'skip'
        ? 'Uploading (skipping duplicates)…'
        : 'Uploading (overriding duplicates)…',
    );

    const uploadResponse = await uploadInventory(
      webAppUrl,
      uploadItems,
      duplicateMode,
      driveFolderId,
    );

    await markItemsSyncedFromUploadResults(database, uploadResponse.results);

    const createdCount = uploadResponse.results.filter(
      (result) => result.status === 'created',
    ).length;
    const updatedCount = uploadResponse.results.filter(
      (result) => result.status === 'updated',
    ).length;
    const skippedCount = uploadResponse.results.filter(
      (result) => result.status === 'skipped',
    ).length;

    setStatusMessage(
      `Sheets sync finished. Created ${createdCount}, updated ${updatedCount}, skipped ${skippedCount}.`,
    );
  }

  /**
   * Builds payload, checks duplicates, then uploads (with Alert when needed).
   */
  async function handleSheetsExport() {
    const house = await getHouseById(database, houseId);

    if (house === null) {
      setErrorMessage('House not found.');
      return;
    }

    const connection = await resolveGasConnection(database);
    const syncRows = await getSyncRowsForHouse(database, houseId);

    if (syncRows.length === 0) {
      setErrorMessage('This house has no items to export yet.');
      return;
    }

    setStatusMessage('Preparing photos for upload…');
    const uploadItems = await buildGasUploadItems(house.name, syncRows);

    setStatusMessage('Checking for duplicates in Google Sheets…');
    const duplicateResponse = await checkDuplicates(
      connection.webAppUrl,
      uploadItems,
    );

    // No clashes — upload everything as an override-safe create/update pass.
    if (duplicateResponse.duplicates.length === 0) {
      await runSheetsUpload(
        connection.webAppUrl,
        connection.driveFolderId,
        uploadItems,
        'override',
      );
      return;
    }

    const previewNames = duplicateResponse.duplicates
      .slice(0, 5)
      .map((duplicate) => `${duplicate.roomName} / ${duplicate.name}`)
      .join('\n');
    const extraCount = duplicateResponse.duplicates.length - 5;
    const extraLine =
      extraCount > 0 ? `\n…and ${extraCount} more.` : '';

    // Pause exporting while the user chooses — Alert callbacks continue the work.
    setIsExporting(false);
    setStatusMessage(
      `Found ${duplicateResponse.duplicates.length} duplicate(s). Choose how to continue.`,
    );

    Alert.alert(
      'Duplicates found',
      `${duplicateResponse.duplicates.length} item(s) already exist in the Sheet:\n\n${previewNames}${extraLine}`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            setStatusMessage('Sheets export cancelled.');
          },
        },
        {
          text: 'Skip duplicates',
          onPress: () => {
            void (async () => {
              setIsExporting(true);
              setErrorMessage(null);

              try {
                await runSheetsUpload(
                  connection.webAppUrl,
                  connection.driveFolderId,
                  uploadItems,
                  'skip',
                );
              } catch (error) {
                console.log('ExportScreen sheets skip error:', error);
                const message =
                  error instanceof Error
                    ? error.message
                    : 'Could not upload to Google Sheets.';
                setErrorMessage(message);
                setStatusMessage(null);
              } finally {
                setIsExporting(false);
              }
            })();
          },
        },
        {
          text: 'Override all',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setIsExporting(true);
              setErrorMessage(null);

              try {
                await runSheetsUpload(
                  connection.webAppUrl,
                  connection.driveFolderId,
                  uploadItems,
                  'override',
                );
              } catch (error) {
                console.log('ExportScreen sheets override error:', error);
                const message =
                  error instanceof Error
                    ? error.message
                    : 'Could not upload to Google Sheets.';
                setErrorMessage(message);
                setStatusMessage(null);
              } finally {
                setIsExporting(false);
              }
            })();
          },
        },
      ],
    );
  }

  /**
   * Local PDF/CSV share or Google Sheets upload for this house.
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
      if (selectedDestination === 'sheets') {
        await handleSheetsExport();
        return;
      }

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
        selectedDestination === 'pdf'
          ? 'Building PDF with photos…'
          : 'Building CSV…',
      );

      await createAndShareInventoryExport({
        format: selectedDestination,
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
        Share a local PDF/CSV, or upload this house to your Google Sheet via Apps
        Script.
      </Text>

      <Text style={[screenStyles.label, { color: colors.text }]}>Destination</Text>

      <Pressable
        style={[
          screenStyles.rowButton,
          {
            borderColor: colors.border,
            backgroundColor:
              selectedDestination === 'pdf' ? colors.headerBackground : 'transparent',
          },
        ]}
        disabled={isExporting}
        onPress={() => setSelectedDestination('pdf')}>
        <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
          {selectedDestination === 'pdf' ? '✓ PDF (details + photos)' : 'PDF (details + photos)'}
        </Text>
      </Pressable>

      <Pressable
        style={[
          screenStyles.rowButton,
          {
            borderColor: colors.border,
            backgroundColor:
              selectedDestination === 'csv' ? colors.headerBackground : 'transparent',
          },
        ]}
        disabled={isExporting}
        onPress={() => setSelectedDestination('csv')}>
        <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
          {selectedDestination === 'csv' ? '✓ CSV (spreadsheet text)' : 'CSV (spreadsheet text)'}
        </Text>
      </Pressable>

      <Pressable
        style={[
          screenStyles.rowButton,
          {
            borderColor: colors.border,
            backgroundColor:
              selectedDestination === 'sheets'
                ? colors.headerBackground
                : 'transparent',
          },
        ]}
        disabled={isExporting}
        onPress={() => setSelectedDestination('sheets')}>
        <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
          {selectedDestination === 'sheets'
            ? '✓ Google Sheets (+ Drive photos)'
            : 'Google Sheets (+ Drive photos)'}
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
        onPress={() => {
          void handleExport();
        }}>
        {isExporting ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={screenStyles.primaryButtonText}>
            {selectedDestination === 'sheets' ? 'Upload to Sheets' : 'Export & Share'}
          </Text>
        )}
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        disabled={isExporting}
        onPress={() => router.push('/settings')}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Open Settings
        </Text>
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
