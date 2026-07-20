import { Alert } from 'react-native';

type ConfirmDestructiveActionOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
};

/**
 * Shows a Cancel / destructive Confirm dialog.
 * Analogy: a “are you sure?” sticky note before throwing something away.
 */
export function confirmDestructiveAction(
  options: ConfirmDestructiveActionOptions,
): void {
  const {
    title,
    message,
    confirmLabel = 'Delete',
    onConfirm,
  } = options;

  Alert.alert(title, message, [
    {
      text: 'Cancel',
      style: 'cancel',
    },
    {
      text: confirmLabel,
      style: 'destructive',
      onPress: onConfirm,
    },
  ]);
}
