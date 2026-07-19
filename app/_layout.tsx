import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { Suspense, useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import AppHeader from '@/components/AppHeader';
import { useColorScheme } from '@/components/useColorScheme';
import { DATABASE_NAME, initializeDatabase } from '@/db/client';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

/**
 * Root layout: opens SQLite, then renders safe area, theme, header, and stack.
 * Expo Router auto-discovers screens under app/ from the file tree.
 */
export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Suspense
          fallback={
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator size="large" />
            </View>
          }>
          <SQLiteProvider
            databaseName={DATABASE_NAME}
            onInit={initializeDatabase}
            useSuspense>
            <View style={{ flex: 1 }}>
              <AppHeader />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: 'transparent' },
                }}>
                <Stack.Screen name="index" />
                <Stack.Screen name="add-house" options={{ presentation: 'modal' }} />
                <Stack.Screen name="categories/index" />
                <Stack.Screen name="categories/[categoryId]" />
                <Stack.Screen name="house/[houseId]/index" />
                <Stack.Screen name="house/[houseId]/add-room" />
                <Stack.Screen name="house/[houseId]/export" />
                <Stack.Screen name="house/[houseId]/import" />
                <Stack.Screen name="house/[houseId]/room/[roomId]/index" />
                <Stack.Screen name="house/[houseId]/room/[roomId]/add-item" />
                <Stack.Screen name="house/[houseId]/room/[roomId]/item/[itemId]/index" />
                <Stack.Screen name="house/[houseId]/room/[roomId]/item/[itemId]/edit" />
              </Stack>
            </View>
          </SQLiteProvider>
        </Suspense>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
