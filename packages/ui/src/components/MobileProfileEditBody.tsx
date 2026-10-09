import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileInput } from './MobileInput';
import { MobileButton } from './MobileButton';
import { MobileProfileAvatar } from './MobileProfileAvatar';
import { MobileBottomSheet } from './MobileBottomSheet';
import { MobileActionSheetBody } from './MobileActionSheetBody';
import { MobileIcon } from '../icons/MobileIcon';
import { tokens } from '../theme/tokens';
import { getCardElevation } from '../theme/elevation';
import { useMobileTheme } from '../theme/ThemeContext';

export interface MobileProfileEditBodyProps {
  initials: string;
  name: string;
  email: string;
  phone?: string;
  /** Optional existing avatar URL (local or remote). */
  avatarUri?: string | null;
}

function nativeElevation(level: 1 | 2 | 3) {
  const { boxShadow: _webOnly, ...rest } = getCardElevation(level);
  return rest;
}

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

function initialsFrom(first: string, last: string, fallback: string): string {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  const built = `${a}${b}`.toUpperCase();
  return built || fallback;
}

type PickImageResult =
  | { status: 'ok'; uri: string }
  | { status: 'canceled' }
  | { status: 'denied' }
  | { status: 'unavailable' };

async function pickImage(source: 'camera' | 'library'): Promise<PickImageResult> {
  try {
    // Resolved from the host Expo app (peer / workspace).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) return { status: 'denied' };
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets[0]?.uri) return { status: 'canceled' };
      return { status: 'ok', uri: result.assets[0].uri };
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled || !result.assets[0]?.uri) return { status: 'canceled' };
    return { status: 'ok', uri: result.assets[0].uri };
  } catch {
    return { status: 'unavailable' };
  }
}

/** Editable profile form shared by drawer “Edit Profile” and App Settings. */
export const MobileProfileEditBody: React.FC<MobileProfileEditBodyProps> = ({
  initials: initialInitials,
  name,
  email: initialEmail,
  phone: initialPhone,
  avatarUri: initialAvatarUri,
}) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const split = useMemo(() => splitName(name), [name]);
  const [firstName, setFirstName] = useState(split.first);
  const [lastName, setLastName] = useState(split.last);
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(initialAvatarUri ?? null);
  const [photoSheetOpen, setPhotoSheetOpen] = useState(false);
  const email = initialEmail;

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || name;
  const initials = initialsFrom(firstName, lastName, initialInitials);

  const cardStyle = {
    backgroundColor: theme.card,
    borderColor: theme.border,
  };

  const closeSheet = () => setPhotoSheetOpen(false);

  const handleSave = () => {
    Alert.alert(t.common.confirm, t.mobile.account.profileSaved);
  };

  const onTakePhoto = async () => {
    closeSheet();
    const result = await pickImage('camera');
    if (result.status === 'ok') setAvatarUri(result.uri);
    else if (result.status === 'denied' || result.status === 'unavailable') {
      Alert.alert(t.mobile.account.editProfile, t.mobile.account.photoPermissionDenied);
    }
  };

  const onChooseLibrary = async () => {
    closeSheet();
    const result = await pickImage('library');
    if (result.status === 'ok') setAvatarUri(result.uri);
    else if (result.status === 'denied' || result.status === 'unavailable') {
      Alert.alert(t.mobile.account.editProfile, t.mobile.account.photoPermissionDenied);
    }
  };

  const onRemovePhoto = () => {
    closeSheet();
    setAvatarUri(null);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.profileHero, nativeElevation(1), cardStyle]}>
          <TouchableOpacity
            onPress={() => setPhotoSheetOpen(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t.mobile.account.changePhoto}
            style={styles.avatarHit}
          >
            <MobileProfileAvatar
              initials={initials}
              imageUri={avatarUri}
              size="lg"
            />
            <View style={[styles.cameraBadge, { backgroundColor: tokens.colors.brand[500], borderColor: theme.card }]}>
              <MobileIcon name="sparkle" size={14} color={tokens.colors.primary} weight="bold" />
            </View>
          </TouchableOpacity>
          <Text style={[styles.changePhotoLabel, { color: theme.textHeading }]}>
            {t.mobile.account.changePhoto}
          </Text>
          <Text style={[styles.profileName, { color: theme.textHeading }]}>{displayName}</Text>
          <Text style={[styles.profileEmail, { color: theme.textSecondary }]}>{email}</Text>
          <Text style={[styles.hint, { color: theme.textSecondary }]}>
            {t.mobile.account.editProfileHint}
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          {t.mobile.account.personalInfo}
        </Text>
        <View style={[styles.card, nativeElevation(1), cardStyle]}>
          <MobileInput
            label={t.mobile.account.firstName}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={t.mobile.account.firstName}
          />
          <View style={styles.fieldGap} />
          <MobileInput
            label={t.mobile.account.lastName}
            value={lastName}
            onChangeText={setLastName}
            placeholder={t.mobile.account.lastName}
          />
          <View style={styles.fieldGap} />
          <MobileInput
            label={t.mobile.account.email}
            value={email}
            editable={false}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder={t.mobile.account.email}
          />
          <Text style={[styles.fieldHint, { color: theme.textSecondary }]}>
            {t.mobile.account.emailManagedInLinkedAccounts}
          </Text>
          <View style={styles.fieldGap} />
          <MobileInput
            label={t.mobile.account.phone}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder={t.mobile.account.phone}
          />
          <View style={styles.saveBtnWrap}>
            <MobileButton onPress={handleSave}>{t.common.save}</MobileButton>
          </View>
        </View>
      </ScrollView>

      <MobileBottomSheet visible={photoSheetOpen} onClose={closeSheet}>
        <MobileActionSheetBody
          title={t.mobile.account.changePhoto}
          actions={[
            {
              key: 'camera',
              label: t.mobile.account.takePhoto,
              onPress: () => {
                void onTakePhoto();
              },
            },
            {
              key: 'library',
              label: t.mobile.account.chooseFromLibrary,
              onPress: () => {
                void onChooseLibrary();
              },
            },
            ...(avatarUri
              ? [
                  {
                    key: 'remove',
                    label: t.mobile.account.removePhoto,
                    danger: true as const,
                    onPress: onRemovePhoto,
                  },
                ]
              : []),
          ]}
        />
      </MobileBottomSheet>
    </>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 0,
  },
  profileHero: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  avatarHit: {
    marginBottom: 4,
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  changePhotoLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 6,
  },
  profileName: {
    fontFamily: tokens.typography.native.headingTh,
    fontSize: 18,
    lineHeight: 27,
    fontWeight: '600',
  },
  profileEmail: {
    fontFamily: tokens.typography.native.body,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 2,
  },
  hint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    marginTop: 8,
  },
  sectionLabel: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    marginBottom: 10,
    marginTop: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  fieldGap: {
    height: 12,
  },
  fieldHint: {
    fontFamily: tokens.typography.native.body,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
  },
  saveBtnWrap: {
    marginTop: 16,
  },
});
