import { StyleSheet } from 'react-native';

/**
 * Shared layout styles reused across inventory screens.
 */
export const screenStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  /**
   * Use this for ScrollView contentContainerStyle — NOT container.
   * flex: 1 on scroll content locks height to the screen and blocks scrolling.
   */
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    opacity: 0.8,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
    marginTop: 12,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  textArea: {
    minHeight: 96,
    maxHeight: 160,
    textAlignVertical: 'top',
  },
  primaryButton: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
  },
  rowButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.7,
    marginTop: 8,
  },
  errorText: {
    color: '#b91c1c',
    marginTop: 8,
    fontSize: 14,
  },
  metaText: {
    fontSize: 14,
    opacity: 0.75,
  },
  /**
   * Extra space before a quiet destructive text link (harder to fat-finger).
   */
  destructiveTextLinkWrap: {
    marginTop: 36,
    marginBottom: 8,
    alignItems: 'center',
    paddingVertical: 8,
  },
  destructiveTextLink: {
    color: '#b91c1c',
    fontSize: 15,
    fontWeight: '500',
    textDecorationLine: 'underline',
  },
  sectionHeading: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 4,
  },
  sectionDivider: {
    height: 1,
    marginTop: 28,
    marginBottom: 20,
    opacity: 0.35,
  },
});
