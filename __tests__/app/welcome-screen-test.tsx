import React from 'react';
import { render, screen } from '@testing-library/react-native';

import WelcomeScreen from '@/app/index';

/**
 * Fake theme hook so we do not depend on React Native's color-scheme API in tests.
 */
jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

/**
 * Fake navigation helpers so the screen can render without a real router.
 */
jest.mock('expo-router', () => {
  const ReactModule = require('react');

  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
      back: jest.fn(),
    }),
    // Runs the focus callback once on mount (like visiting the screen).
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactModule.useEffect(() => {
        const cleanup = effect();

        if (typeof cleanup === 'function') {
          return cleanup;
        }

        return undefined;
      }, [effect]);
    },
    // Link with asChild just renders its child button in tests.
    Link: ({ children }: { children: React.ReactNode }) => children,
  };
});

/**
 * Fake SQLite context — use one stable object.
 * Why: a new `{}` every call would change useCallback deps and loop forever.
 */
jest.mock('expo-sqlite', () => {
  const stableFakeDatabase = {};

  return {
    useSQLiteContext: () => stableFakeDatabase,
  };
});

/**
 * Fake house loader so the Welcome screen can finish loading with known data.
 */
jest.mock('@/db/houses', () => ({
  getAllHouses: jest.fn(async () => []),
}));

/**
 * Smoke test: does the Welcome screen show its main labels after loading?
 *
 * Note: @testing-library/react-native v14 made render() async — always await it.
 * Analogy: wait for the oven preheat before you check if the cake is baking.
 */
describe('<WelcomeScreen />', () => {
  test('shows the welcome title and Add House button after houses load', async () => {
    await render(<WelcomeScreen />);

    // findBy* waits for async house loading to finish.
    expect(await screen.findByText('Welcome to Home Inventory')).toBeTruthy();
    expect(screen.getByText('Add House')).toBeTruthy();
    expect(screen.getByText('View House')).toBeTruthy();
    expect(
      await screen.findByText('No houses yet. Tap Add House to create your first one.'),
    ).toBeTruthy();
  });
});
