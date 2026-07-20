import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import KeyboardAwareFormScroll, {
  FormTextInput,
} from '@/components/KeyboardAwareFormScroll';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';
import { screenStyles } from '@/constants/screenStyles';
import { getAppSettings, updateAppSettings } from '@/db/settings';
import { getEnvGasDefaults, pingGas } from '@/lib/gasClient';
import type { DefaultImageSource } from '@/types/inventory';

/**
 * Reads the display version from app.json (via Expo), with a safe fallback.
 */
function getAppDisplayVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

/**
 * App Settings: cloud sync URL/folder + default photo source for empty taps.
 */
export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme];
  const database = useSQLiteContext();
  const router = useRouter();
  const appDisplayVersion = getAppDisplayVersion();

  const [webAppUrl, setWebAppUrl] = useState('');
  const [driveFolderId, setDriveFolderId] = useState('');
  const [defaultImageSource, setDefaultImageSource] =
    useState<DefaultImageSource>('camera');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    /**
     * Loads SQLite settings; seeds empty cloud fields from local env defaults.
     */
    async function loadSettings() {
      try {
        const appSettings = await getAppSettings(database);
        const envDefaults = getEnvGasDefaults();

        setWebAppUrl(appSettings.gasWebAppUrl ?? envDefaults.webAppUrl);
        setDriveFolderId(
          appSettings.defaultDriveFolderId ?? envDefaults.driveFolderId,
        );
        setDefaultImageSource(appSettings.defaultImageSource);
      } catch (error) {
        console.log('SettingsScreen load error:', error);
        setErrorMessage('Could not load settings.');
      } finally {
        setIsLoading(false);
      }
    }

    void loadSettings();
  }, [database]);

  /**
   * Persists cloud URL, folder id, and photo preference into app_settings.
   */
  async function handleSaveSettings() {
    setIsSaving(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const trimmedWebAppUrl = webAppUrl.trim();
      const trimmedDriveFolderId = driveFolderId.trim();

      await updateAppSettings(database, {
        gasWebAppUrl: trimmedWebAppUrl.length > 0 ? trimmedWebAppUrl : null,
        defaultDriveFolderId:
          trimmedDriveFolderId.length > 0 ? trimmedDriveFolderId : null,
        defaultImageSource,
      });

      setStatusMessage('Settings saved on this phone.');
    } catch (error) {
      console.log('SettingsScreen save error:', error);
      setErrorMessage('Could not save settings.');
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * Calls GAS ping without printing the secret URL.
   */
  async function handleTestConnection() {
    const trimmedWebAppUrl = webAppUrl.trim();

    if (trimmedWebAppUrl.length === 0) {
      setErrorMessage('Paste your Web App /exec URL first.');
      return;
    }

    setIsTesting(true);
    setErrorMessage(null);
    setStatusMessage(null);

    try {
      const pingResponse = await pingGas(trimmedWebAppUrl);
      setStatusMessage(pingResponse.message);
    } catch (error) {
      console.log('SettingsScreen ping error:', error);
      const message =
        error instanceof Error ? error.message : 'Connection test failed.';
      setErrorMessage(message);
    } finally {
      setIsTesting(false);
    }
  }

  if (isLoading) {
    return (
      <View style={[screenStyles.container, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.tint} />
      </View>
    );
  }

  return (
    <KeyboardAwareFormScroll backgroundColor={colors.background}>
      <Text style={[screenStyles.title, { color: colors.text }]}>Settings</Text>

      <Text style={[screenStyles.sectionHeading, { color: colors.text }]}>
        Default photo source
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text, marginBottom: 8 }]}>
        Used when you tap an empty Add photo area (faster Add Item). Changing an
        existing photo still shows the full menu.
      </Text>

      <Pressable
        style={[
          screenStyles.rowButton,
          {
            borderColor: colors.border,
            backgroundColor:
              defaultImageSource === 'camera'
                ? colors.headerBackground
                : 'transparent',
          },
        ]}
        disabled={isSaving || isTesting}
        onPress={() => setDefaultImageSource('camera')}>
        <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
          {defaultImageSource === 'camera' ? '✓ Camera' : 'Camera'}
        </Text>
      </Pressable>

      <Pressable
        style={[
          screenStyles.rowButton,
          {
            borderColor: colors.border,
            backgroundColor:
              defaultImageSource === 'gallery'
                ? colors.headerBackground
                : 'transparent',
          },
        ]}
        disabled={isSaving || isTesting}
        onPress={() => setDefaultImageSource('gallery')}>
        <Text style={[screenStyles.rowButtonText, { color: colors.text }]}>
          {defaultImageSource === 'gallery' ? '✓ Gallery' : 'Gallery'}
        </Text>
      </Pressable>

      <View style={[screenStyles.sectionDivider, { backgroundColor: colors.border }]} />

      <Text style={[screenStyles.sectionHeading, { color: colors.text }]}>
        Cloud Sync Settings
      </Text>
      <Text style={[screenStyles.metaText, { color: colors.text, marginBottom: 8 }]}>
        Store your Google Apps Script Web App URL and optional Drive folder id on
        this phone. Treat the URL like a private key — do not share it.
      </Text>

      <Text style={[screenStyles.label, { color: colors.text }]}>
        Web App URL (/exec)
      </Text>
      <FormTextInput
        value={webAppUrl}
        onChangeText={setWebAppUrl}
        placeholder="https://script.google.com/macros/s/…/exec"
        placeholderTextColor={colors.border}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
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
        Drive folder id (optional)
      </Text>
      <FormTextInput
        value={driveFolderId}
        onChangeText={setDriveFolderId}
        placeholder="Last part of the Drive folder URL"
        placeholderTextColor={colors.border}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          screenStyles.input,
          {
            color: colors.text,
            borderColor: colors.border,
            backgroundColor: colors.headerBackground,
          },
        ]}
      />

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
          { backgroundColor: colors.tint, opacity: isSaving ? 0.7 : 1 },
        ]}
        disabled={isSaving || isTesting}
        onPress={() => {
          void handleSaveSettings();
        }}>
        {isSaving ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={screenStyles.primaryButtonText}>Save</Text>
        )}
      </Pressable>

      <Pressable
        style={[
          screenStyles.secondaryButton,
          { borderColor: colors.border, opacity: isTesting ? 0.7 : 1 },
        ]}
        disabled={isSaving || isTesting}
        onPress={() => {
          void handleTestConnection();
        }}>
        {isTesting ? (
          <ActivityIndicator color={colors.tint} />
        ) : (
          <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
            Test connection
          </Text>
        )}
      </Pressable>

      <Pressable
        style={[screenStyles.secondaryButton, { borderColor: colors.border }]}
        disabled={isSaving || isTesting}
        onPress={() => router.back()}>
        <Text style={[screenStyles.secondaryButtonText, { color: colors.text }]}>
          Back
        </Text>
      </Pressable>

      <Text
        style={[
          screenStyles.metaText,
          { color: colors.text, marginTop: 24, textAlign: 'center' },
        ]}>
        App version {appDisplayVersion}
      </Text>
    </KeyboardAwareFormScroll>
  );
}
