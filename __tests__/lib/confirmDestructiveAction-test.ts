import { Alert } from 'react-native';

import { confirmDestructiveAction } from '@/lib/confirmDestructiveAction';

jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

describe('confirmDestructiveAction', () => {
  beforeEach(() => {
    jest.mocked(Alert.alert).mockClear();
  });

  test('shows Cancel and a destructive confirm button with default label', () => {
    const onConfirm = jest.fn();

    confirmDestructiveAction({
      title: 'Delete item?',
      message: 'This cannot be undone on the phone.',
      onConfirm,
    });

    expect(Alert.alert).toHaveBeenCalledTimes(1);

    const [title, message, buttons] = jest.mocked(Alert.alert).mock.calls[0];

    expect(title).toBe('Delete item?');
    expect(message).toBe('This cannot be undone on the phone.');
    expect(buttons).toEqual([
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
  });

  test('uses a custom confirm label when provided', () => {
    const onConfirm = jest.fn();

    confirmDestructiveAction({
      title: 'Delete house?',
      message: 'Removes local data only.',
      confirmLabel: 'Delete house',
      onConfirm,
    });

    const buttons = jest.mocked(Alert.alert).mock.calls[0][2] as Array<{
      text: string;
      onPress?: () => void;
    }>;

    expect(buttons[1].text).toBe('Delete house');

    // Pressing confirm should run the caller's callback.
    buttons[1].onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
