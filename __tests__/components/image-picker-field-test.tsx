import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import ImagePickerField from '@/components/ImagePickerField';
import { getAppSettings } from '@/db/settings';
import { pickDownscaleAndSaveItemImage } from '@/lib/images';

let mockFocusEffectCallback: (() => void | (() => void)) | undefined;

jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    mockFocusEffectCallback = callback;
  },
}));

jest.mock('expo-sqlite', () => ({
  useSQLiteContext: () => ({ databaseName: 'test' }),
}));

jest.mock('@/components/useColorScheme', () => ({
  useColorScheme: () => 'light',
}));

jest.mock('@/db/settings', () => ({
  getAppSettings: jest.fn(),
}));

jest.mock('@/lib/images', () => ({
  deleteLocalImageIfExists: jest.fn(),
  pickDownscaleAndSaveItemImage: jest.fn(),
}));

const mockGetAppSettings = jest.mocked(getAppSettings);
const mockPickDownscaleAndSaveItemImage = jest.mocked(
  pickDownscaleAndSaveItemImage,
);

describe('<ImagePickerField />', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFocusEffectCallback = undefined;
  });

  test('reloads the default source when its screen regains focus', async () => {
    mockGetAppSettings.mockResolvedValue({
      id: 1,
      gasWebAppUrl: null,
      defaultDriveFolderId: null,
      defaultImageSource: 'gallery',
    });
    mockPickDownscaleAndSaveItemImage.mockResolvedValue(null);

    await render(
      <ImagePickerField
        imageUri={null}
        houseFolderPath="file:///house"
        onImageChange={jest.fn()}
      />,
    );

    await act(async () => {
      mockFocusEffectCallback?.();
    });

    expect(await screen.findByText('Tap to choose from gallery')).toBeTruthy();
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Add or change item photo'));
    });
    expect(mockPickDownscaleAndSaveItemImage).toHaveBeenCalledWith({
      source: 'gallery',
      houseFolderPath: 'file:///house',
    });

    mockGetAppSettings.mockResolvedValue({
      id: 1,
      gasWebAppUrl: null,
      defaultDriveFolderId: null,
      defaultImageSource: 'camera',
    });

    await act(async () => {
      mockFocusEffectCallback?.();
    });

    expect(await screen.findByText('Tap to take a photo')).toBeTruthy();
  });
});
