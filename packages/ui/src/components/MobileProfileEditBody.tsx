import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActionSheetIOS,
  Platform,
  Pressable,
} from 'react-native';
import { useLocale } from '@nestyk/i18n';
import { MobileInput } from './MobileInput';
import { MobileButton } from './MobileButton';
import { MobileProfileAvatar } from './MobileProfileAvatar';
import { MobileIcon } from '../icons/MobileIcon';
import { tokens } from '../theme/tokens';
import { getCardElevation } from '../theme/elevation';
import { useMobileTheme } from '../theme/ThemeContext';

export type ProfilePhotoFile = {
  uri: string;
  name: string;
  mimeType: string;
  file?: Blob;
};

export type ProfileSaveInput = {
  firstName: string;
  lastName: string;
  phone: string | null;
};

export interface MobileProfileEditBodyProps {
  initials: string;
  name: string;
  email: string;
  phone?: string;
  /** Optional existing avatar URL (local or remote). */
  avatarUri?: string | null;
  onSave?: (input: ProfileSaveInput) => Promise<void>;
  onUploadAvatar?: (photo: ProfilePhotoFile) => Promise<string>;
  onRemoveAvatar?: () => Promise<void>;
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
  | { status: 'ok'; photo: ProfilePhotoFile }
  | { status: 'canceled' }
  | { status: 'denied' }
  | { status: 'unavailable' };

function pickedPhoto(asset: { uri: string; fileName?: string | null; mimeType?: string | null; file?: Blob | null }): ProfilePhotoFile {
  return {
    uri: asset.uri,
    name: asset.fileName || 'profile-photo.jpg',
    mimeType: asset.mimeType || 'image/jpeg',
    file: asset.file ?? undefined,
  };
}

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
      return { status: 'ok', photo: pickedPhoto(result.assets[0]) };
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
    return { status: 'ok', photo: pickedPhoto(result.assets[0]) };
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
  onSave,
  onUploadAvatar,
  onRemoveAvatar,
}) => {
  const { t } = useLocale();
  const { theme } = useMobileTheme();
  const split = useMemo(() => splitName(name), [name]);
  const [firstName, setFirstName] = useState(split.first);
  const [lastName, setLastName] = useState(split.last);
  const [phone, setPhone] = useState(initialPhone ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(initialAvatarUri ?? null);
  const [pendingPhoto, setPendingPhoto] = useState<ProfilePhotoFile | null>(null);
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const email = initialEmail;

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || name;
  const initials = initialsFrom(firstName, lastName, initialInitials);

  const cardStyle = {
    backgroundColor: theme.card,
    borderColor: theme.border,
  };

  const applyPicked = (photo: ProfilePhotoFile) => {
    setPendingPhoto(photo);
    setAvatarRemoved(false);
    setAvatarUri(photo.uri);
    setError(null);
  };

  const handleSave = async () => {
    if (saving) return;
    if (!onSave) {
      Alert.alert(t.common.confirm, t.mobile.account.profileSaved);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (avatarRemoved) await onRemoveAvatar?.();
      else if (pendingPhoto) await onUploadAvatar?.(pendingPhoto);
      await onSave({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() ? phone.trim() : null,
      });
      setPendingPhoto(null);
      setAvatarRemoved(false);
      Alert.alert(t.common.confirm, t.mobile.account.profileSaved);
    } catch (cause) {
      const message = cause instanceof Error && cause.message ? cause.message : t.common.errorGeneric;
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const choosePhoto = async (source: 'camera' | 'library') => {
    const result = await pickImage(source);
    if (result.status === 'ok') applyPicked(result.photo);
    else if (result.status === 'denied' || result.status === 'unavailable') {
      Alert.alert(t.mobile.account.editProfile, t.mobile.account.photoPermissionDenied);
    }
  };

  const removePhoto = () => {
    setPendingPhoto(null);
    setAvatarRemoved(true);
    setAvatarUri(null);
  };

  const openPhotoChoices = () => {
    const take = t.mobile.account.takePhoto;
    const library = t.mobile.account.chooseFromLibrary;
    const remove = t.mobile.account.removePhoto;
    const cancel = t.common.cancel;
    const options = avatarUri ? [take, library, remove, cancel] : [take, library, cancel];
    const cancelIndex = options.length - 1;
    const removeIndex = avatarUri ? 2 : undefined;
    const run = (index: number) => {
      const start = () => {
        if (index === 0) void choosePhoto('camera');
        else if (index === 1) void choosePhoto('library');
        else if (index === removeIndex) removePhoto();
      };
      if (Platform.OS === 'ios' && index !== cancelIndex) setTimeout(start, 350);
      else start();
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex: cancelIndex, destructiveButtonIndex: removeIndex },
        run,
      );
      return;
    }
    Alert.alert(t.mobile.account.changePhoto, undefined, [
      { text: take, onPress: () => { void choosePhoto('camera'); } },
      { text: library, onPress: () => { void choosePhoto('library'); } },
      ...(avatarUri ? [{ text: remove, style: 'destructive' as const, onPress: removePhoto }] : []),
      { text: cancel, style: 'cancel' as const },
    ]);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.profileHero, nativeElevation(1), cardStyle]}>
          <Pressable
            onPress={openPhotoChoices}
            accessibilityRole="button"
            accessibilityLabel={t.mobile.account.changePhoto}
            android_ripple={{ color: 'rgba(33,30,30,0.08)', borderless: false }}
            style={({ pressed }) => [styles.photoButton, pressed && styles.photoButtonPressed]}
          >
            <View style={styles.avatarHit}>
              <MobileProfileAvatar
                initials={initials}
                imageUri={avatarUri}
                size="lg"
              />
              <View style={[styles.cameraBadge, { backgroundColor: tokens.colors.brand[500], borderColor: theme.card }]}>
                <MobileIcon name="camera" size={14} color={tokens.colors.primary} weight="bold" />
              </View>
            </View>
            <Text style={[styles.changePhotoLabel, { color: theme.textHeading }]}>
              {t.mobile.account.changePhoto}
            </Text>
          </Pressable>
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
          {error ? (
            <Text accessibilityRole="alert" style={[styles.fieldHint, { color: tokens.colors.error }]}>{error}</Text>
          ) : null}
          <View style={styles.saveBtnWrap}>
            <MobileButton onPress={() => { void handleSave(); }} isLoading={saving} disabled={saving}>{t.common.save}</MobileButton>
          </View>
        </View>
      </ScrollView>
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
  photoButton: {
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  photoButtonPressed: {
    opacity: 0.7,
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
