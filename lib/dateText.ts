/**
 * Basic YYYY-MM-DD check for optional date text fields (purchase date, etc.).
 * Empty / whitespace-only is allowed (means "no date").
 */
export function isValidOptionalYyyyMmDd(dateText: string): boolean {
  const trimmedDateText = dateText.trim();

  // Blank means the user left the field empty on purpose.
  if (trimmedDateText.length === 0) {
    return true;
  }

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmedDateText);
}

/**
 * Trims optional date text to null when blank (call after isValidOptionalYyyyMmDd).
 */
export function normalizeOptionalYyyyMmDd(dateText: string): string | null {
  const trimmedDateText = dateText.trim();

  if (trimmedDateText.length === 0) {
    return null;
  }

  return trimmedDateText;
}
