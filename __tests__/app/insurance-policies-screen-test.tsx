import React from 'react';
import { render, screen } from '@testing-library/react-native';

import InsurancePoliciesScreen from '@/app/house/[houseId]/policies/index';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('expo-router', () => {
  const ReactModule = require('react');

  return {
    useRouter: () => ({
      push: jest.fn(),
      replace: jest.fn(),
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

jest.mock('@/db/insurancePolicies', () => ({
  getPoliciesByHouseId: jest.fn(async () => []),
}));

/**
 * Smoke test: empty policies list shows local-only guidance.
 */
describe('<InsurancePoliciesScreen />', () => {
  test('shows empty state and local-only note', async () => {
    await render(<InsurancePoliciesScreen />);

    expect(await screen.findByText('Beach House Policies')).toBeTruthy();
    expect(
      await screen.findByText(
        'Stored only on this phone. Policies are not uploaded to Google Sheets or Drive.',
      ),
    ).toBeTruthy();
    expect(
      await screen.findByText(
        'No policies yet. Tap Add Policy to store one for this house.',
      ),
    ).toBeTruthy();
    expect(await screen.findByText('Add Policy')).toBeTruthy();
  });
});
