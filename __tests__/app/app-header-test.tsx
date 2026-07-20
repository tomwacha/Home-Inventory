import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import AppHeader from '@/components/AppHeader';
import { getAllHouses } from '@/db/houses';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  }),
}));

jest.mock('expo-router', () => ({
  usePathname: () => '/house/1',
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
  }),
}));

jest.mock('expo-sqlite', () => {
  const stableFakeDatabase = {};

  return {
    useSQLiteContext: () => stableFakeDatabase,
  };
});

jest.mock('@/db/houses', () => ({
  getAllHouses: jest.fn(async () => [
    {
      id: 1,
      name: 'Beach House',
      folderPath: 'file:///houses/Beach/',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 2,
      name: 'Cabin',
      folderPath: 'file:///houses/Cabin/',
      createdAt: '2026-01-02T00:00:00.000Z',
    },
  ]),
}));

/**
 * Smoke tests for the header house dropdown refresh behavior.
 */
describe('<AppHeader />', () => {
  beforeEach(() => {
    jest.mocked(getAllHouses).mockClear();
  });

  test('loads houses on mount and refreshes again when opening the dropdown', async () => {
    await render(<AppHeader />);

    // First load happens from the pathname useEffect on mount.
    await waitFor(() => {
      expect(getAllHouses).toHaveBeenCalled();
    });

    const callCountAfterMount = jest.mocked(getAllHouses).mock.calls.length;
    expect(callCountAfterMount).toBeGreaterThanOrEqual(1);

    expect(await screen.findByText('Select house')).toBeTruthy();

    // Opening the selector should fetch again so newly added houses appear.
    fireEvent.press(screen.getByLabelText('Select house'));

    await waitFor(() => {
      expect(jest.mocked(getAllHouses).mock.calls.length).toBeGreaterThan(callCountAfterMount);
    });

    expect(await screen.findByText('Beach House')).toBeTruthy();
    expect(screen.getByText('Cabin')).toBeTruthy();
  });
});
