import { Platform } from 'react-native';
import { apiPatch, apiRequest } from './api';

export type ProfileSaveInput = {
  firstName: string;
  lastName: string;
  phone: string | null;
};

export type ProfilePhotoFile = {
  uri: string;
  name: string;
  mimeType: string;
  file?: Blob;
};

type ProfileResponse = { avatarUrl: string | null };

export function updateMyProfile(input: ProfileSaveInput): Promise<ProfileResponse> {
  return apiPatch<ProfileResponse>('/auth/profile', input);
}

export async function uploadProfileAvatar(photo: ProfilePhotoFile): Promise<string> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const file = photo.file ?? await (await fetch(photo.uri)).blob();
    form.append('file', file, photo.name);
  } else {
    form.append('file', { uri: photo.uri, name: photo.name, type: photo.mimeType } as unknown as Blob);
  }
  const result = await apiRequest<ProfileResponse>('/auth/profile/avatar/upload', { method: 'POST', body: form });
  return result.avatarUrl ?? '';
}

export function clearProfileAvatar(): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>('/auth/profile/avatar', { method: 'DELETE' });
}
