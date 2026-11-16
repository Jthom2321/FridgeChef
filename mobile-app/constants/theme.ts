/**
 * FridgeChef design tokens. Values come from the "FridgeChef UI" design canvas.
 */

export const Colors = {
  accent: '#C2410C',
  accentPressed: '#9A3412',
  ink: '#17251E',
  muted: '#55645C',
  background: '#F2F5F1',
  surface: '#FFFFFF',
  border: '#CBD5CE',
  divider: '#DCE3DD',
  avatar: '#DCE8DF',
  success: '#2F6B4F',
  successDeep: '#1F4D37',
  successSoft: '#E3F0E6',
  dashed: '#9AA89F',

  // Cook Mode (dark)
  cookBackground: '#17251E',
  cookSurface: '#25372D',
  cookTrack: '#3A4F43',
  cookAccent: '#FDBA8C',
  cookMuted: '#B8CDBF',
  cookText: '#DDE7E0',
};

/** Pastel "magnet" tints, each with its darker ink and drop edge. */
export const Tints = {
  butter: { bg: '#FFF1C7', edge: '#E3D39E', ink: '#7A5B00' },
  sky: { bg: '#E4ECF7', edge: '#C2CFE0', ink: '#1E3A64' },
  mint: { bg: '#E3F0E6', edge: '#C3D9C9', ink: '#1F4D37' },
  peach: { bg: '#FDE7DA', edge: '#EEC8B2', ink: '#9A3412' },
};

export type TintName = keyof typeof Tints;

/** Loaded in app/_layout.tsx. Custom fonts carry their own weight, so don't also set fontWeight. */
export const Fonts = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
};
