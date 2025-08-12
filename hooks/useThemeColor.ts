import { useColorScheme as useRNColorScheme } from 'react-native';

type ColorSchemeName = 'light' | 'dark';

/**
 * Custom hook to pick a color based on current theme and fallback colors.
 * @param props object with optional light and dark colors
 * @param colorName name of the color for default fallback (like 'background', 'text')
 * @returns string color based on theme or fallback
 */
export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: string
) {
  const colorScheme = useRNColorScheme() ?? 'light' as ColorSchemeName;

  if (props[colorScheme]) {
    return props[colorScheme]!;
  }

  // Default colors to use if no custom color provided
  const defaultColors: Record<string, Record<ColorSchemeName, string>> = {
    background: { light: '#ffffff', dark: '#000000' },
    text: { light: '#000000', dark: '#ffffff' },
    // Add more named colors here if needed
  };

  return defaultColors[colorName]?.[colorScheme] ?? props.light ?? props.dark ?? '#ffffff';
}

// Default export to satisfy React Native routing requirements
export default useThemeColor;
