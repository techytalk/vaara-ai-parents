/** Vaara's semantic brand system. Keep screen styles mapped to these tokens. */
export const colors = {
  navy: "#0D1B2A",
  teal: "#0E9A8A",
  coral: "#FF6F61",
  amber: "#F5A623",
  lavender: "#A78BFA",
  warmWhite: "#FFFCF7",

  primary: "#0E9A8A",
  primaryDark: "#08786D",
  primaryLight: "#BFE9E4",
  primarySoft: "#EAF8F6",

  accent: "#FF6F61",
  accentDark: "#D94E43",
  accentLight: "#FFE4DF",

  bg: "#FFFCF7",
  card: "#FFFFFF",
  surfaceMuted: "#F7F4EE",
  surfaceNavy: "#0D1B2A",
  text: "#0D1B2A",
  textMuted: "#5E6974",
  textSubtle: "#85909A",
  textInverse: "#FFFFFF",
  border: "#E8E3DB",
  borderLight: "#F3EFE8",

  error: "#dc2626",
  errorSoft: "#FEECEC",
  success: "#078675",
  successSoft: "#E7F7F4",
  warning: "#B96D00",
  warningSoft: "#FFF2D9",
  shadow: "#0D1B2A",

  /** Tab bar & chrome */
  tabActive: "#0E9A8A",
  tabInactive: "#89929B",
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  xxxl: 40,
} as const;

export const radii = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  regular: "PlusJakartaSans_400Regular",
  medium: "PlusJakartaSans_500Medium",
  semibold: "PlusJakartaSans_600SemiBold",
  bold: "PlusJakartaSans_700Bold",
  display: { fontSize: 30, lineHeight: 38 },
  screenTitle: { fontSize: 24, lineHeight: 31 },
  sectionTitle: { fontSize: 18, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22 },
  supporting: { fontSize: 13, lineHeight: 18 },
  caption: { fontSize: 11, lineHeight: 15 },
} as const;

export const shadows = {
  card: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  floating: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 7,
  },
} as const;

export const avatarPalette = [
  "#0E9A8A",
  "#0891b2",
  "#059669",
  "#F5A623",
  "#A78BFA",
  "#FF6F61",
];
