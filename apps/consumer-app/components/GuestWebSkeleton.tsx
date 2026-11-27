import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocale } from '@nestyk/i18n';
import { MobileNestykLogo, useMobileTheme } from '@nestyk/ui/native';

/** The guest page's header ink (loading design A, Mos 25 Nov 2026): the same colour as the splash and the preload. */
const INK = '#211E1E';
const ON_INK = 'rgba(255,255,255,0.14)';

/**
 * Outline of the guest home while the guest web loads in the app (canvas page "loading", board A3): ink header with
 * the logo and the search box, two room cards and the bottom tab bar (5 tabs, as the guest web), in place of a spinner on a blank screen.
 * A rough outline only: it does not try to match the page pixel for pixel.
 */
export function GuestWebSkeleton() {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const insets = useSafeAreaInsets();
  const bone = { backgroundColor: theme.border };

  return (
    <View
      style={[styles.fill, { backgroundColor: theme.background }]}
      accessibilityRole="progressbar"
      accessibilityLabel={t.mobile.preload.preparing}
      testID="guestWeb.loading"
    >
      <View style={[styles.hero, { paddingTop: insets.top + 12, backgroundColor: INK }]}>
        <View style={styles.bar}>
          <View style={[styles.dot, { backgroundColor: ON_INK }]} />
          <MobileNestykLogo variant="wordmarkOnDark" height={24} />
          <View style={[styles.dot, styles.right, { backgroundColor: ON_INK }]} />
        </View>
        <View style={[styles.line, { width: '78%', backgroundColor: ON_INK }]} />
        <View style={[styles.line, { width: '52%', backgroundColor: ON_INK }]} />
        <View style={[styles.box, { backgroundColor: theme.surface }]} />
      </View>
      <View style={styles.body}>
        <View style={[styles.title, bone]} />
        <View style={styles.cards}>
          {[0, 1].map((key) => (
            <View key={key} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <View style={[styles.photo, bone]} />
              <View style={styles.cardText}>
                <View style={[styles.text, bone, { width: '60%' }]} />
                <View style={[styles.text, bone, { width: '85%' }]} />
              </View>
            </View>
          ))}
        </View>
      </View>
      <View
        style={[
          styles.tabs,
          { bottom: insets.bottom + 10, backgroundColor: theme.card, borderColor: theme.border },
        ]}
      >
        {[0, 1, 2, 3, 4].map((key) => (
          <View key={key} style={[styles.tab, bone]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject },
  hero: { paddingHorizontal: 16, paddingBottom: 20, borderBottomLeftRadius: 22, borderBottomRightRadius: 22, gap: 14 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  dot: { width: 36, height: 36, borderRadius: 18 },
  right: { marginLeft: 'auto' },
  line: { height: 20, borderRadius: 8 },
  box: { height: 48, borderRadius: 14 },
  body: { padding: 16, gap: 12 },
  title: { width: '55%', height: 16, borderRadius: 6 },
  cards: { flexDirection: 'row', gap: 12, overflow: 'hidden' },
  card: { width: '66%', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  photo: { height: 130, borderRadius: 0 },
  cardText: { padding: 12, gap: 8 },
  text: { height: 12, borderRadius: 6 },
  tabs: {
    position: 'absolute',
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    borderRadius: 20,
    borderWidth: 1,
  },
  tab: { width: 40, height: 34, borderRadius: 10 },
});
