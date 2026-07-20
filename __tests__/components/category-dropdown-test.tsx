import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

import CategoryDropdown from '@/components/CategoryDropdown';

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('<CategoryDropdown />', () => {
  test('shows the selected category label when closed', async () => {
    const onSelectCategoryId = jest.fn();
    const onPressManageCategories = jest.fn();

    await render(
      <CategoryDropdown
        categories={[
          { id: 1, name: 'Appliances' },
          { id: 2, name: 'Furniture' },
        ]}
        selectedCategoryId={2}
        onSelectCategoryId={onSelectCategoryId}
        onPressManageCategories={onPressManageCategories}
      />,
    );

    expect(screen.getByText('Furniture')).toBeTruthy();
  });

  test('opens the list and selects None', async () => {
    const onSelectCategoryId = jest.fn();

    await render(
      <CategoryDropdown
        categories={[{ id: 1, name: 'Appliances' }]}
        selectedCategoryId={1}
        onSelectCategoryId={onSelectCategoryId}
        onPressManageCategories={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByLabelText('Select category'));
    expect(await screen.findByText('Category')).toBeTruthy();

    fireEvent.press(screen.getByText('None'));
    expect(onSelectCategoryId).toHaveBeenCalledWith(null);
  });
});
