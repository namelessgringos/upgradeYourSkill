/**
 * Design tokens — ported verbatim from the Sudoku app (constants/theme.ts) so
 * Skills Coach speaks ONE design language. Do not introduce a second palette.
 *
 * Source of truth for the visual system is documented in docs/DESIGN_SYSTEM.md.
 */
import { Platform } from 'react-native';

/**
 * The "paper & ink" journal palette. Import these directly in components
 * (matches the Sudoku convention: `import { JournalColors } from '@/constants/theme'`).
 */
export const JournalColors = {
  paperBg: '#F5F0E8',
  paperDark: '#EDE6D6',
  inkBlack: '#1A1008',
  inkBrown: '#3D2B1F',
  inkFaint: '#8B7355',
  gridLine: '#C4A882',
  gridLineBold: '#6B4C2A',
  accent: '#8B1A1A',
  selected: '#D4E8C2',
  selectedBorder: '#4A7C3F',
  invalid: '#F5E6E0',
  invalidBorder: '#A0291E',
  flash: '#F2D0C4',
  heartFill: '#8B1A1A',
  heartEmpty: '#C4A882',
  tabActive: '#4A3728',
  tabInactive: '#8B7355',
  buttonPrimary: '#4A3728',
  buttonDanger: '#8B1A1A',
  buttonDisabled: '#C4A882',
  white: '#FDFAF3',
  shadow: 'rgba(61, 43, 31, 0.15)',
} as const;

const tintColorLight = JournalColors.tabActive;
const tintColorDark = '#fff';

/** Light/dark semantic colors consumed via the useThemeColor hook. */
export const Colors = {
  light: {
    text: JournalColors.inkBlack,
    background: JournalColors.paperBg,
    tint: tintColorLight,
    icon: JournalColors.inkFaint,
    tabIconDefault: JournalColors.tabInactive,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: '#ECEDEE',
    background: '#151718',
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

/**
 * Spacing / radius / elevation scale extracted from the Sudoku components
 * (NumberPad, SudokuCell). Use these instead of ad-hoc numbers so the two
 * products stay visually identical.
 */
export const Spacing = { xs: 4, sm: 6, md: 8, lg: 16, xl: 24 } as const;
export const Radius = { card: 6, sheet: 12, pill: 999 } as const;
export const Elevation = {
  card: {
    shadowColor: JournalColors.shadow,
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 2,
  },
} as const;
