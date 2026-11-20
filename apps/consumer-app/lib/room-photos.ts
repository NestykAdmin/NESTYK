import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import type { RoomPhoto } from '@nestyk/feature-listing';
import { apiRequest } from './api';
import { ensureAgentSession } from './agent-session';

export async function pickRoomPhotos(limit: number): Promise<RoomPhoto[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: true,
    selectionLimit: limit,
    quality: 0.8,
    preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
  });
  if (result.canceled) return [];
  return result.assets.slice(0, limit).map((asset) => ({
    uri: asset.uri,
    name: asset.fileName ?? 'room-photo.jpg',
    mimeType: asset.mimeType ?? 'image/jpeg',
    file: asset.file,
  }));
}

export async function uploadRoomPhoto(photo: RoomPhoto): Promise<string> {
  await ensureAgentSession();
  return uploadRoomPhotoTo('/agent/rooms/media/upload', photo);
}

/** One room photo to an upload endpoint (agent or self owner: same storage and rules); returns its stored URL. */
export async function uploadRoomPhotoTo(path: string, photo: RoomPhoto): Promise<string> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const file = photo.file ?? await (await fetch(photo.uri)).blob();
    form.append('file', file, photo.name);
  } else {
    form.append('file', { uri: photo.uri, name: photo.name, type: photo.mimeType } as unknown as Blob);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const result = await apiRequest<{ mediaUrl: string }>(path, { method: 'POST', body: form, signal: controller.signal });
    return result.mediaUrl;
  } finally {
    clearTimeout(timeout);
  }
}

/** Upload + Claid enhance; returns a photo already stored with mediaUrl (skip re-upload on submit). */
export async function enhanceRoomPhoto(photo: RoomPhoto): Promise<RoomPhoto> {
  await ensureAgentSession();
  const form = new FormData();
  if (Platform.OS === 'web') {
    const file = photo.file ?? await (await fetch(photo.uri)).blob();
    form.append('file', file, photo.name);
  } else {
    form.append('file', { uri: photo.uri, name: photo.name, type: photo.mimeType } as unknown as Blob);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);
  try {
    const result = await apiRequest<{ mediaUrl: string }>('/agent/rooms/media/enhance', {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    return {
      uri: result.mediaUrl,
      mediaUrl: result.mediaUrl,
      name: photo.name.replace(/\.[^.]+$/, '') + '-enhanced.jpg',
      mimeType: 'image/jpeg',
    };
  } finally {
    clearTimeout(timeout);
  }
}
