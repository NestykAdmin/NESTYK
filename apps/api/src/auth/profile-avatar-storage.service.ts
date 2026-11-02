import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

export const MAX_PROFILE_AVATAR_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ProfileAvatarStorage {
  private client?: SupabaseClient;
  private readonly bucket = process.env.SUPABASE_BUCKET_AVATARS || 'profile-avatars';
  private bucketReady?: Promise<void>;

  private async ensureBucket() {
    this.storage();
    this.bucketReady ??= (async () => {
      const storage = this.client!.storage;
      const { data, error } = await storage.listBuckets();
      if (error) throw new ServiceUnavailableException('Unable to check profile photo storage');
      if (data?.some((bucket) => bucket.name === this.bucket)) return;
      const { error: createError } = await storage.createBucket(this.bucket, {
        public: true,
        fileSizeLimit: MAX_PROFILE_AVATAR_BYTES,
        allowedMimeTypes: ['image/jpeg'],
      });
      if (createError && !createError.message.toLowerCase().includes('already exists')) {
        throw new ServiceUnavailableException('Unable to initialize profile photo storage');
      }
    })().catch((error) => {
      this.bucketReady = undefined;
      throw error;
    });
    await this.bucketReady;
  }

  private storage() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new ServiceUnavailableException('Profile photo storage is not configured');
    this.client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return this.client.storage.from(this.bucket);
  }

  async upload(userId: number, file: { buffer: Buffer; size: number } | undefined): Promise<string> {
    if (!Number.isInteger(userId) || userId < 1) throw new BadRequestException('User is required');
    if (!file?.buffer?.length) throw new BadRequestException('Choose an image file');
    if (file.buffer.length > MAX_PROFILE_AVATAR_BYTES) throw new BadRequestException('Photo must be 5 MB or smaller');
    let image: Buffer;
    try {
      const input = sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: 'warning' });
      const metadata = await input.metadata();
      if (!['jpeg', 'png', 'webp', 'heif', 'avif'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) {
        throw new Error('Unsupported image');
      }
      image = await input.rotate().resize(512, 512, { fit: 'cover' }).jpeg({ quality: 80 }).toBuffer();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Use a valid JPEG, PNG or WebP image');
    }
    await this.ensureBucket();
    const objectPath = `${userId}/${randomUUID()}.jpg`;
    const storage = this.storage();
    const { error } = await storage.upload(objectPath, image, {
      contentType: 'image/jpeg',
      cacheControl: '3600',
      upsert: false,
    });
    if (error) throw new ServiceUnavailableException('Unable to upload profile photo; please try again');
    const avatarUrl = storage.getPublicUrl(objectPath).data.publicUrl;
    if (!avatarUrl || avatarUrl.length > 512) throw new ServiceUnavailableException('Profile photo address is not usable');
    return avatarUrl;
  }
}
