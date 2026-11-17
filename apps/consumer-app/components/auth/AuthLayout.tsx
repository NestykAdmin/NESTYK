import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
  type ViewStyle,
} from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMobileTheme } from "@nestyk/ui/native";
import { authLayoutMode } from "../../lib/auth/auth-layout-rules";
import { useKeyboardFrame } from "../../lib/auth/keyboard-frame";

/** Photo band height on phones; the sheet overlaps its bottom by SHEET_OVERLAP. */
const BAND_OPEN = 176;
/** With the keyboard up the band keeps only the logo row. */
const BAND_FOLDED = 56;
const SHEET_OVERLAP = 16;
const CARD_WIDTH = 480;
/** Tablets in sheet mode (≤ 768 px): the form keeps a phone-like width in the middle of the sheet. */
const SHEET_MAX_WIDTH = 520;

type Props = {
  photo: ImageSourcePropType;
  /** Logo and language button, drawn on the photo. */
  topBar: React.ReactNode;
  /** Headline on the photo band (phones only, hidden while typing). */
  hero?: React.ReactNode;
  /** The form fields. */
  children: React.ReactNode;
  /** The main button (and its note). Pinned above the keyboard on phones while typing. */
  action: React.ReactNode;
  /** Everything below the main button: other sign-in ways, sign up, browse as guest. */
  after?: React.ReactNode;
  /** The page's AuthLegalFooter; the layout picks its tone (pill on the photo, plain grey on the white sheet). */
  footer: React.ReactElement<{ tone?: "photo" | "plain" }>;
};

/**
 * Frame of the sign-in pages, mixed design (Mos 17 Nov 2026, canvas page "หน้า login ใหม่"):
 * - wider than 768 px: a 480 px card on the full photo, logo and language above it, links below (design B);
 * - 768 px and below: the photo as a band on top and the form as a sheet (design A). While the keyboard is up the
 *   band folds to the logo row and the main button leaves the scroll view, so it stays right above the keyboard.
 */
export function AuthLayout({ photo, topBar, hero, children, action, after, footer }: Props) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { theme } = useMobileTheme();
  const keyboard = useKeyboardFrame();
  const mode = authLayoutMode(width);
  const legal = React.cloneElement(footer, { tone: mode === "card" ? "photo" : "plain" });

  if (mode === "card") {
    return (
      <View style={[styles.root, { backgroundColor: theme.background }]}>
        <StatusBar style="light" />
        <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
        <View pointerEvents="none" style={styles.shade} />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.cardScreen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}
          >
            <View style={styles.cardColumn}>
              <View style={styles.topBar}>{topBar}</View>
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                {children}
                {action}
                {after}
              </View>
              {legal}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    );
  }

  const folded = keyboard.open;
  // Web: phone browsers only shrink the visual viewport, so the page sizes itself to the part above the keyboard.
  const webFrame =
    Platform.OS === "web" && keyboard.open
      ? ({ position: "fixed", top: keyboard.top, left: 0, right: 0, height: keyboard.height } as unknown as ViewStyle)
      : null;
  return (
    <View style={[styles.root, { backgroundColor: theme.card }, webFrame]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View
          style={[
            styles.band,
            { height: (folded ? BAND_FOLDED : BAND_OPEN) + insets.top, paddingTop: insets.top + (folded ? 0 : 14) },
            folded && styles.bandFolded,
          ]}
        >
          <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View pointerEvents="none" style={styles.shade} />
          <View style={styles.topBar}>{topBar}</View>
          {folded ? null : hero}
        </View>
        <View style={[styles.sheet, { backgroundColor: theme.card }, folded && styles.sheetFolded]}>
          <ScrollView
            style={styles.flex}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.sheetContent, { paddingBottom: folded ? 12 : insets.bottom + 12 }]}
          >
            {children}
            {folded ? null : action}
            {after}
            {legal}
          </ScrollView>
          {keyboard.open ? (
            <View style={[styles.actionBar, { borderTopColor: theme.border, backgroundColor: theme.card }]}>{action}</View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  shade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(33,30,30,0.16)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  cardScreen: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  cardColumn: {
    width: "100%",
    maxWidth: CARD_WIDTH,
    alignSelf: "center",
    gap: 20,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 16,
    shadowColor: "#211E1E",
    shadowOpacity: 0.18,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
  },
  band: {
    paddingHorizontal: 20,
    paddingBottom: SHEET_OVERLAP + 14,
    justifyContent: "space-between",
    overflow: "hidden",
  },
  bandFolded: {
    paddingBottom: 0,
    justifyContent: "center",
  },
  sheet: {
    flex: 1,
    marginTop: -SHEET_OVERLAP,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  sheetFolded: {
    marginTop: 0,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  sheetContent: {
    flexGrow: 1,
    width: "100%",
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  actionBar: {
    width: "100%",
    maxWidth: SHEET_MAX_WIDTH,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
