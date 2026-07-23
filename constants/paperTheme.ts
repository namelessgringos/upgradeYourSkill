/**
 * react-native-paper themed with the "paper & ink" palette, so we get Material
 * structure — elevation, ripple, snackbars — in the app's own warm skin rather
 * than stock Material purple. The colour source of truth stays JournalColors;
 * this file only maps those tokens onto the MD3 roles Paper expects.
 */
import { MD3LightTheme, configureFonts, type MD3Theme } from 'react-native-paper';
import { Fonts, JournalColors } from './theme';

const serif = Fonts?.serif ?? 'serif';

// Display and heading roles carry the serif; body and label stay in the system
// face for legibility at small sizes. Everything else inherits MD3 defaults.
const fontConfig = {
  displayLarge: { fontFamily: serif, fontWeight: '700' as const },
  displayMedium: { fontFamily: serif, fontWeight: '700' as const },
  displaySmall: { fontFamily: serif, fontWeight: '700' as const },
  headlineLarge: { fontFamily: serif, fontWeight: '700' as const },
  headlineMedium: { fontFamily: serif, fontWeight: '700' as const },
  headlineSmall: { fontFamily: serif, fontWeight: '700' as const },
  titleLarge: { fontFamily: serif, fontWeight: '700' as const },
};

export const paperTheme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 3, // Radius.card (6) / 2 — Paper multiplies roundness by 2.
  fonts: configureFonts({ config: fontConfig }),
  colors: {
    ...MD3LightTheme.colors,
    primary: JournalColors.buttonPrimary,
    onPrimary: JournalColors.white,
    primaryContainer: JournalColors.paperDark,
    onPrimaryContainer: JournalColors.inkBlack,
    secondary: JournalColors.inkBrown,
    onSecondary: JournalColors.white,
    secondaryContainer: JournalColors.selected,
    onSecondaryContainer: JournalColors.inkBlack,
    tertiary: JournalColors.accent,
    onTertiary: JournalColors.white,
    background: JournalColors.paperBg,
    onBackground: JournalColors.inkBlack,
    surface: JournalColors.white,
    onSurface: JournalColors.inkBlack,
    surfaceVariant: JournalColors.paperDark,
    onSurfaceVariant: JournalColors.inkBrown,
    surfaceDisabled: JournalColors.paperDark,
    onSurfaceDisabled: JournalColors.inkFaint,
    outline: JournalColors.gridLine,
    outlineVariant: JournalColors.gridLine,
    error: JournalColors.buttonDanger,
    onError: JournalColors.white,
    elevation: {
      ...MD3LightTheme.colors.elevation,
      level0: 'transparent',
      level1: JournalColors.white,
      level2: JournalColors.white,
      level3: JournalColors.paperDark,
      level4: JournalColors.paperDark,
      level5: JournalColors.paperDark,
    },
  },
};
