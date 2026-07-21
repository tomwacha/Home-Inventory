import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import HouseMainScreen from '@/app/house/[houseId]/index';

const mockPush = jest.fn();
const mockReplace = jest.fn();

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

jest.mock('expo-router', () => {
  const ReactModule = require('react');

  return {
    useRouter: () => ({
      push: mockPush,
      replace: mockReplace,
      back: jest.fn(),
    }),
    useLocalSearchParams: () => ({ houseId: '1' }),
    useFocusEffect: (effect: () => void | (() => void)) => {
      ReactModule.useEffect(() => {
        const cleanup = effect();

        if (typeof cleanup === 'function') {
          return cleanup;
        }

        return undefined;
      }, [effect]);
    },
  };
});

jest.mock('expo-sqlite', () => {
  const stableFakeDatabase = {};

  return {
    useSQLiteContext: () => stableFakeDatabase,
  };
});

jest.mock('@/db/houses', () => ({
  getHouseById: jest.fn(async () => ({
    id: 1,
    name: 'Beach House',
    folderPath: 'file:///houses/Beach/',
    createdAt: '2026-01-01T00:00:00.000Z',
  })),
}));

jest.mock('@/db/rooms', () => ({
  getRoomsByHouseId: jest.fn(async () => []),
}));

jest.mock('@/db/items', () => ({
  getHouseTotals: jest.fn(async () => ({
    itemCount: 0,
    totalValueUsd: 0,
  })),
  searchItemsInHouse: jest.fn(async () => []),
}));

/**
 * Smoke tests for House Main Page navigation helpers.
 */
describe('<HouseMainScreen />', () => {
  beforeEach(() => {
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  test('shows compact house actions and navigates to each target', async () => {
    await render(<HouseMainScreen />);

    expect(await screen.findByText('Beach House')).toBeTruthy();
    expect(await screen.findByText('Add Room')).toBeTruthy();
    expect(await screen.findByText('Edit House')).toBeTruthy();
    expect(await screen.findByText('View Policies')).toBeTruthy();
    expect(await screen.findByText('Manage Categories')).toBeTruthy();

    fireEvent.press(await screen.findByText('Add Room'));
    expect(mockPush).toHaveBeenCalledWith('/house/1/add-room');

    fireEvent.press(await screen.findByText('Edit House'));
    expect(mockPush).toHaveBeenCalledWith('/house/1/edit');

    fireEvent.press(await screen.findByText('View Policies'));
    expect(mockPush).toHaveBeenCalledWith('/house/1/policies');

    fireEvent.press(await screen.findByText('Manage Categories'));
    expect(mockPush).toHaveBeenCalledWith('/categories');
  });

  test('shows Back to Welcome and navigates home when pressed', async () => {
    await render(<HouseMainScreen />);

    const backButton = await screen.findByText('Back to Welcome');
    fireEvent.press(backButton);

    expect(mockReplace).toHaveBeenCalledWith('/');
  });
});
