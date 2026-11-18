import React, { useEffect } from 'react';
import {
  BackHandler,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MobileButton, getCardElevation, tokens } from '@nestyk/ui/native';

export type RoomPhotoCompareProps = {
  visible: boolean;
  beforeUri: string;
  afterUri: string;
  labels: {
    title: string;
    before: string;
    after: string;
    useEnhanced: string;
    keepOriginal: string;
    viewPhoto: string;
  };
  quotaNote?: string;
  busy?: boolean;
  onUseEnhanced: () => void;
  onDismiss: () => void;
  onPreview?: (params: { uri: string; beforeUri?: string }) => void;
};

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

export function RoomPhotoCompareModal({
  visible,
  beforeUri,
  afterUri,
  labels,
  quotaNote,
  busy,
  onUseEnhanced,
  onDismiss,
  onPreview,
}: RoomPhotoCompareProps) {
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!busy) onDismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible, busy, onDismiss]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onDismiss(); }}>
      <View style={[styles.overlay, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        <Pressable style={StyleSheet.absoluteFill} disabled={busy} onPress={() => { if (!busy) onDismiss(); }} />
        <View style={[styles.card, nativeElevation(2)]} pointerEvents="box-none">
          <Text style={styles.title}>{labels.title}</Text>
          {quotaNote ? <Text style={styles.quotaNote}>{quotaNote}</Text> : null}
          <View style={styles.row}>
            <View style={styles.col}>
              <Text style={styles.caption}>{labels.before}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={labels.viewPhoto}
                disabled={busy || !onPreview}
                onPress={() => onPreview?.({ uri: beforeUri })}
                style={({ pressed }) => [styles.imageHit, pressed && !busy ? styles.imagePressed : null]}
              >
                <View pointerEvents="none">
                  <Image
                    source={{ uri: beforeUri, cache: 'force-cache' }}
                    style={styles.image}
                  />
                </View>
              </Pressable>
            </View>
            <View style={styles.col}>
              <Text style={styles.caption}>{labels.after}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={labels.viewPhoto}
                disabled={busy || !onPreview}
                onPress={() => onPreview?.({ uri: afterUri, beforeUri })}
                style={({ pressed }) => [styles.imageHit, pressed && !busy ? styles.imagePressed : null]}
              >
                <View pointerEvents="none">
                  <Image
                    source={{ uri: afterUri, cache: 'force-cache' }}
                    style={styles.image}
                  />
                </View>
              </Pressable>
            </View>
          </View>
          <View style={styles.actions}>
            <View style={{ flex: 1 }}>
              <MobileButton variant="outline" disabled={busy} onPress={onDismiss}>
                {labels.keepOriginal}
              </MobileButton>
            </View>
            <View style={{ flex: 1 }}>
              <MobileButton disabled={busy} isLoading={busy} onPress={onUseEnhanced}>
                {labels.useEnhanced}
              </MobileButton>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(33, 30, 30, 0.55)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    zIndex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: tokens.colors.border,
    padding: 16,
    gap: 14,
  },
  title: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 17,
    lineHeight: 26,
    color: tokens.colors.textHeading,
  },
  quotaNote: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    color: tokens.colors.textSecondary,
    marginTop: -6,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  col: {
    flex: 1,
    gap: 6,
  },
  caption: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: '600',
    color: tokens.colors.textSecondary,
    textAlign: 'center',
  },
  imageHit: {
    alignSelf: 'stretch',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  imagePressed: {
    opacity: 0.88,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
