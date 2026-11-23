import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { UserRole } from '@nestyk/types';
import { roleTileColors, tokens } from '../theme/tokens';
import { useMobileTheme } from '../theme/ThemeContext';

export type MobileProfileAvatarSize = 'sm' | 'md' | 'lg';

const SIZE_MAP: Record<
  MobileProfileAvatarSize,
  { ring: number; avatar: number; font: number; border: number }
> = {
  sm: { ring: 44, avatar: 36, font: 13, border: 2 },
  md: { ring: 56, avatar: 48, font: 16, border: 2 },
  lg: { ring: 72, avatar: 62, font: 20, border: 2.5 },
};

export interface MobileProfileAvatarProps {
  initials: string;
  imageUri?: string | null;
  size?: MobileProfileAvatarSize;
  /** The role the signed-in user is in: the avatar takes that role's identity colours, as on the web. */
  role?: UserRole;
  style?: ViewStyle;
}

/** The signed-in user's own avatar — shared across header, drawer, profile detail, settings. */
export const MobileProfileAvatar: React.FC<MobileProfileAvatarProps> = ({
  initials,
  imageUri,
  size = 'md',
  role,
  style,
}) => {
  const { isDark } = useMobileTheme();
  const dims = SIZE_MAP[size];
  // Role identity colours (Mos 20 Nov 2026, same as the web): tile fill, initials and ring of the current role;
  // ink and gold now mean admin only. Without a role it keeps the v1.2 look (ink, yellow initials, lifted grey in dark).
  const tile = role ? roleTileColors(role, isDark) : null;
  const fill = tile ? tile.bg : isDark ? tokens.colors.lift : tokens.colors.primary;
  const ring = tile ? tile.ring : isDark ? 'rgba(248,182,21,0.65)' : '#F8B615';
  const text = tile ? tile.fg : tokens.colors.brand[500];

  return (
    <View
      style={[
        styles.ring,
        {
          width: dims.ring,
          height: dims.ring,
          borderRadius: dims.ring / 2,
          borderWidth: dims.border,
          borderColor: ring,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.avatar,
          {
            width: dims.avatar,
            height: dims.avatar,
            borderRadius: dims.avatar / 2,
            backgroundColor: fill,
            overflow: 'hidden',
          },
        ]}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} accessibilityIgnoresInvertColors />
        ) : (
          <Text style={[styles.text, { fontSize: dims.font, lineHeight: dims.font * 1.5, color: text }]}>
            {initials}
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  text: {
    fontFamily: tokens.typography.native.headingEn,
    fontWeight: '600',
  },
});
