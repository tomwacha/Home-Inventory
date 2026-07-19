import { useColorScheme as useColorSchemeCore } from 'react-native';

/**
 * Returns the active color scheme, defaulting to light when unspecified.
 */
export function useColorScheme(): 'light' | 'dark' {
  const coreScheme = useColorSchemeCore();
  return coreScheme === 'dark' ? 'dark' : 'light';
}
