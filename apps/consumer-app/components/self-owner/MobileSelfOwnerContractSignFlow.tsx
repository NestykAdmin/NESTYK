import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileIcon, tokens, useMobileTheme } from '@nestyk/ui/native';
import { interpolate } from '@nestyk/feature-listing';
import type { SelfOwnerContract } from '../../lib/self-owner-contracts';
import { ContractSignaturePad, type ContractSignaturePadHandle } from '../ContractSignaturePad';
import { contractDetailView, contractSigningView } from './contract-detail-rows';
import { MobileSelfOwnerSignerList } from './MobileSelfOwnerContractSigning';
import { SelfOwnerContractDocument } from './SelfOwnerContractDocument';
import { selfOwnerDocumentOf } from './demo-documents';
import { FadeIn } from './FadeIn';
import { useStepSlide } from './useStepSlide';

const { subtle } = tokens.colors;
export type SelfOwnerSignStep = 'review' | 'sign' | 'done';

/** The "signed" mark grows in once, 200 ms, answering the confirm; still with reduced motion (Jom 25 Nov 2026). */
function PopIn({ children, style }: { children: React.ReactNode; style?: object }) {
  const [progress] = useState(() => new Animated.Value(0));
  useEffect(() => {
    let cancelled = false;
    const run = Animated.timing(progress, { toValue: 1, duration: 200, easing: Easing.out(Easing.back(1.6)), useNativeDriver: true });
    void AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) progress.setValue(1);
        else run.start();
      });
    return () => {
      cancelled = true;
      run.stop();
    };
  }, [progress]);
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  return <Animated.View style={[style, { opacity: progress, transform: [{ scale }] }]}>{children}</Animated.View>;
}

/**
 * The separate sign page on the phone (Jom 25 Nov 2026, option B, demo): step 1 the contract file, read to its last
 * page before the owner can tick that they read it (the summary when there is no file), step 2 the existing signature
 * pad, then what happened. The modal
 * stops scrolling on step 2 (`onStepChange`), so drawing does not scroll the page.
 */
export function MobileSelfOwnerContractSignFlow({
  contract,
  all,
  fmt,
  today,
  onSign,
  onDone,
  onStepChange,
  initialStep = 'review',
  initialAccepted = false,
  initialReachedEnd = false,
}: {
  /** The contract as the page has it now (signed once `onSign` went through). */
  contract: SelfOwnerContract;
  all: SelfOwnerContract[];
  fmt: { money: (amount: number) => string; day: (ymd: string) => string };
  today: string;
  onSign: (contractId: string) => void;
  /** Back to the contract detail. */
  onDone: () => void;
  onStepChange?: (step: SelfOwnerSignStep) => void;
  initialStep?: SelfOwnerSignStep;
  initialAccepted?: boolean;
  /** The owner has turned to the file's last page (tests). */
  initialReachedEnd?: boolean;
}) {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const so = t.selfOwnerContracts;
  const ink = theme.screenTitle;
  const muted = theme.textSecondary;
  const [step, setStepState] = useState<SelfOwnerSignStep>(initialStep);
  const [accepted, setAccepted] = useState(initialAccepted);
  const [error, setError] = useState('');
  const file = selfOwnerDocumentOf(contract.id);
  // With a file, the tick waits until the owner turned to its last page (Jom 25 Nov 2026).
  const [reachedEnd, setReachedEnd] = useState(initialReachedEnd || file === undefined);
  const pad = useRef<ContractSignaturePadHandle>(null);
  const signing = contractSigningView(contract, so, fmt.day);
  const view = contractDetailView(contract, all, so, fmt, today);
  const shown: SelfOwnerSignStep = signing.canSign ? step : 'done';
  const setStep = (next: SelfOwnerSignStep) => {
    setError('');
    setStepState(next);
    onStepChange?.(next);
  };
  const stepLabel = (n: number, name: string) => interpolate(so.signStep, { n, total: 2, name });
  // Each step fades in (Jom 25 Nov 2026).
  const slide = useStepSlide(['review', 'sign', 'done'].indexOf(shown));
  const button = (testID: string, label: string, onPress: () => void, primary = false, disabled = false) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, primary ? { backgroundColor: ink, borderColor: ink } : { borderColor: theme.border, backgroundColor: theme.surface }, disabled ? styles.off : null]}
    >
      <Text style={[styles.small, { color: primary ? theme.surface : ink }]}>{label}</Text>
    </Pressable>
  );
  const term = (label: string, value: string) => (
    <View key={label} style={styles.term}>
      <Text style={[styles.small, { color: muted }]}>{label}</Text>
      <Text style={[styles.small, styles.value, { color: ink }]}>{value}</Text>
    </View>
  );

  if (shown === 'done') {
    return (
      <FadeIn key={shown} active={slide !== null} fill>
        <View testID="soc-sign-flow" style={styles.root}>
          <View accessibilityRole="alert" style={[styles.card, styles.done, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <PopIn style={[styles.mark, { backgroundColor: subtle.successBg ?? theme.background }]}>
              <MobileIcon name="check" size={22} color={subtle.successFg ?? ink} />
            </PopIn>
            <Text style={[styles.title, { color: ink }]}>{so.signedTitle}</Text>
            <Text style={[styles.small, { color: muted, textAlign: 'center' }]}>{signing.waiting ? so.waitingOthers : so.signedAll}</Text>
          </View>
          <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
            <MobileSelfOwnerSignerList view={signing} />
          </View>
          {button('soc-sign-done', so.backToContract, onDone, true)}
        </View>
      </FadeIn>
    );
  }

  return (
    <FadeIn key={shown} active={slide !== null} fill>
      <View testID="soc-sign-flow" style={[styles.root, shown === 'review' && file !== undefined ? styles.grow : null]}>
        {shown === 'review' ? (
          <>
            <Text style={[styles.small, { color: muted }]}>{stepLabel(1, so.signStepReview)}</Text>
            {file !== undefined ? (
              <>
                <View>
                  <Text style={[styles.small, { color: muted }]}>{so.kind[contract.kind]}</Text>
                  <Text style={[styles.title, { color: ink }]}>{view.period}</Text>
                  <Text style={[styles.small, { color: muted }]}>{view.room}</Text>
                </View>
                <View style={[styles.demo, { backgroundColor: subtle.brandBg }]}>
                  <MobileIcon name="info" size={14} color={subtle.warningFg} />
                  <Text style={[styles.small, styles.flex, { color: subtle.warningFg }]}>{so.sampleDocument}</Text>
                </View>
                {/* The file fills the space left; the modal does not scroll around it, so there is one scroll only. */}
                <SelfOwnerContractDocument source={file} onReachedEnd={() => setReachedEnd(true)} fill />
                <View style={styles.read}>
                  {reachedEnd ? <MobileIcon name="check" size={14} color={subtle.successFg ?? ink} /> : null}
                  <Text style={[styles.small, styles.flex, { color: reachedEnd ? subtle.successFg ?? ink : muted }]}>{reachedEnd ? so.readDone : so.readToEnd}</Text>
                </View>
              </>
            ) : (
            <>
            <View style={[styles.note, { backgroundColor: theme.surface, borderColor: theme.border }]}>
              <MobileIcon name="file-text" size={16} color={muted} />
              <Text style={[styles.small, styles.flex, { color: muted }]}>{so.noFileSummary}</Text>
            </View>
            <View style={[styles.card, { borderColor: theme.border, backgroundColor: theme.surface }]}>
              <Text style={[styles.small, { color: muted }]}>{so.kind[contract.kind]}</Text>
              <Text style={[styles.title, { color: ink }]}>{view.period}</Text>
              <Text style={[styles.small, { color: muted }]}>{view.room}</Text>
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
              {term(view.party.role, view.party.name)}
              {view.tiles.map((tile) => term(tile.label, tile.value))}
              {view.extra.map(([label, value]) => term(label, value))}
              <View style={[styles.rule, { backgroundColor: theme.border }]} />
              <Text style={[styles.body, { color: ink }]}>{so.signing}</Text>
              <MobileSelfOwnerSignerList view={signing} />
            </View>
            </>
            )}
            <Pressable
              testID="soc-sign-accept"
              accessibilityRole="checkbox"
              accessibilityState={{ checked: accepted, disabled: !reachedEnd }}
              disabled={!reachedEnd}
              onPress={() => setAccepted(!accepted)}
              style={[styles.accept, reachedEnd ? null : styles.off]}
            >
              <View style={[styles.box, { borderColor: accepted ? ink : theme.border, backgroundColor: accepted ? ink : theme.surface }]}>
                {accepted ? <MobileIcon name="check" size={14} color={theme.surface} /> : null}
              </View>
              <Text style={[styles.small, styles.flex, { color: ink }]}>{so.acceptTerms}</Text>
            </Pressable>
            <View style={styles.actions}>
              {button('soc-sign-cancel', so.cancelSigning, onDone)}
              {button('soc-sign-next', so.nextStep, () => setStep('sign'), true, !accepted || !reachedEnd)}
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.small, { color: muted }]}>{stepLabel(2, so.signStepSign)}</Text>
            <Text style={[styles.small, { color: ink }]}>{so.signHint}</Text>
            <View style={[styles.demo, { backgroundColor: subtle.brandBg }]}>
              <MobileIcon name="info" size={14} color={subtle.warningFg} />
              <Text style={[styles.small, styles.flex, { color: subtle.warningFg }]}>{so.demoSignNote}</Text>
            </View>
            {error ? (
              <Text accessibilityRole="alert" style={[styles.small, { color: subtle.dangerFg }]}>
                {error}
              </Text>
            ) : null}
            <View style={[styles.canvas, { borderColor: theme.border }]}>
              <ContractSignaturePad
                ref={pad}
                onOK={() => {
                  setStep('done');
                  onSign(contract.id);
                }}
                onEmpty={() => setError(so.signEmpty)}
              />
            </View>
            <View style={styles.actions}>
              {button('soc-sign-previous', so.previousStep, () => setStep('review'))}
              {button('soc-sign-clear', so.clearSignature, () => pad.current?.clearSignature())}
              {button('soc-sign-confirm', so.confirmSignature, () => pad.current?.readSignature(), true)}
            </View>
          </>
        )}
      </View>
    </FadeIn>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  grow: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  title: { fontFamily: tokens.typography.native.bodyBold, fontSize: 16, lineHeight: 24 },
  body: { fontFamily: tokens.typography.native.body, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: tokens.typography.native.body, fontSize: 13, lineHeight: 19 },
  value: { flexShrink: 1, textAlign: 'right' },
  card: { gap: 8, padding: 14, borderRadius: 14, borderWidth: 1 },
  note: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  term: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  read: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rule: { height: StyleSheet.hairlineWidth },
  accept: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  box: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderRadius: 6, borderWidth: 1.5 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  button: { minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1 },
  off: { opacity: 0.45 },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  canvas: { borderWidth: 1, borderRadius: 10, overflow: 'hidden' },
  done: { alignItems: 'center' },
  mark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
});
