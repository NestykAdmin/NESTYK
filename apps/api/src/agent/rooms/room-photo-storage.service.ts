import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import sharp from 'sharp';

import { MAX_ROOM_PHOTO_BYTES } from './room-photo-limits';

export { MAX_ROOM_PHOTO_BYTES };
const IMAGE_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.jpg$/;

@Injectable()
export class RoomPhotoStorageService {
  private client?: SupabaseClient;
  private readonly bucket = process.env.SUPABASE_BUCKET_PROPERTIES || 'property-images';

  private bucketReady?: Promise<void>;

  private async ensureBucket() {
    this.storage();
    this.bucketReady ??= (async () => {
      const storage = this.client!.storage;
      const { data, error } = await storage.listBuckets();
      if (error) throw new ServiceUnavailableException('Unable to check room photo storage');
      if (data?.some((bucket) => bucket.name === this.bucket)) return;
      const { error: createError } = await storage.createBucket(this.bucket, {
        public: true, fileSizeLimit: MAX_ROOM_PHOTO_BYTES, allowedMimeTypes: ['image/jpeg'],
      });
      if (createError && !createError.message.toLowerCase().includes('already exists')) {
        throw new ServiceUnavailableException('Unable to initialize room photo storage');
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
    if (!url || !key) throw new ServiceUnavailableException('Room photo storage is not configured');
    this.client ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    return this.client.storage.from(this.bucket);
  }

  private async normalizeJpeg(file: { buffer: Buffer; size: number } | undefined): Promise<Buffer> {
    if (!file?.buffer?.length) throw new BadRequestException('Choose an image file');
    if (file.buffer.length > MAX_ROOM_PHOTO_BYTES) throw new BadRequestException('Photo must be 10 MB or smaller');
    try {
      const input = sharp(file.buffer, { limitInputPixels: 40_000_000, failOn: 'warning' });
      const metadata = await input.metadata();
      if (!['jpeg', 'png', 'webp', 'heif', 'avif'].includes(metadata.format ?? '') || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
      // Decode and re-encode: reject corrupt/non-image uploads, normalize orientation,
      // remove EXIF (including GPS), and bound the stored image dimensions.
      return input.rotate().resize({ width: 2400, height: 2400, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer();
    } catch (error) {
      if (error instanceof BadRequestException) throw error;
      throw new BadRequestException('Use a valid JPEG, PNG or WebP image (up to 40 megapixels)');
    }
  }

  private async storeJpeg(agentId: number, image: Buffer) {
    await this.ensureBucket();
    const name = `${randomUUID()}.jpg`;
    const storage = this.storage();
    const objectPath = `${agentId}/${name}`;
    const { error } = await storage.upload(objectPath, image, {
      contentType: 'image/jpeg', cacheControl: '31536000', upsert: false,
    });
    if (error) throw new ServiceUnavailableException('Unable to upload room photo; please try again');
    return { mediaUrl: storage.getPublicUrl(objectPath).data.publicUrl };
  }

  async upload(agentId: number, file: { buffer: Buffer; size: number } | undefined, _baseUrl: string) {
    const image = await this.normalizeJpeg(file);
    return this.storeJpeg(agentId, image);
  }

  async enhance(agentId: number, file: { buffer: Buffer; size: number } | undefined, _baseUrl: string) {
    const mock =
      /^(1|true|yes)$/i.test(String(process.env.CLAID_MOCK ?? '').trim());
    const image = await this.normalizeJpeg(file);

    if (mock) {
      // Dev/demo: skip Claid — mild local enhance so Before/After is visible.
      await new Promise((r) => setTimeout(r, 700));
      const enhanced = await sharp(image)
        .modulate({ brightness: 1.06, saturation: 1.08 })
        .sharpen({ sigma: 0.8 })
        .jpeg({ quality: 90 })
        .toBuffer();
      return this.storeJpeg(agentId, enhanced);
    }

    const apiKey = process.env.CLAID_API_KEY?.trim().replace(/^['"]|['"]$/g, '');
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'AI photo enhance is not configured — set CLAID_MOCK=true or CLAID_API_KEY in .env.api and restart the API',
      );
    }

    const claidBase = (process.env.CLAID_API_URL?.trim().replace(/^['"]|['"]$/g, '') || 'https://api.claid.ai').replace(/\/$/, '');

    // Upload bytes directly to Claid — do not pass local Supabase URLs (Claid cannot reach 127.0.0.1).
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(image)], { type: 'image/jpeg' }), 'room.jpg');
    // Claid validates `data` as a JSON string (not a file/blob part).
    form.append(
      'data',
      JSON.stringify({
        operations: {
          adjustments: { hdr: 80, sharpness: 25 },
          restorations: { decompress: 'auto', upscale: 'smart_enhance' },
        },
        output: { format: { type: 'jpeg', quality: 90 } },
      }),
    );

    let editResponse: Response;
    try {
      editResponse = await fetch(`${claidBase}/v1/image/edit/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      });
    } catch {
      throw new ServiceUnavailableException('Unable to reach AI photo service; please try again');
    }

    const raw = await editResponse.text();
    let payload: {
      data?: { output?: { tmp_url?: string } };
      error_message?: string;
      message?: string;
    } = {};
    try { payload = raw ? JSON.parse(raw) : {}; } catch { /* keep empty */ }
    const claidMessage = payload.error_message || payload.message;

    if (editResponse.status === 401 || editResponse.status === 403) {
      throw new ServiceUnavailableException(claidMessage || 'AI photo enhance key is invalid or missing image_editing permission');
    }
    if (editResponse.status === 402) {
      throw new ServiceUnavailableException(claidMessage || 'AI photo enhance quota exceeded');
    }
    if (!editResponse.ok) {
      throw new ServiceUnavailableException(claidMessage || 'AI photo enhance failed; please try again');
    }

    const tmpUrl = payload?.data?.output?.tmp_url;
    if (!tmpUrl || typeof tmpUrl !== 'string') {
      throw new ServiceUnavailableException('AI photo enhance returned no image');
    }

    let enhanced: Buffer;
    try {
      const imageResponse = await fetch(tmpUrl);
      if (!imageResponse.ok) throw new Error('download failed');
      enhanced = Buffer.from(await imageResponse.arrayBuffer());
    } catch {
      throw new ServiceUnavailableException('Unable to download enhanced photo; please try again');
    }
    if (!enhanced.length) throw new BadRequestException('Enhanced photo was empty');
    return this.storeJpeg(agentId, enhanced);
  }

  async validateRoomPhotos(agentId: number, medias: Array<{ mediaUrl: string; mediaType?: string; category?: string }>, baseUrl: string) {
    const seen = new Set<string>();
    for (const media of medias) {
      let url: URL;
      try { url = new URL(media.mediaUrl); } catch { throw new BadRequestException('Invalid photo URL'); }
      if (!!url.search || !!url.hash || !!url.username || !!url.password || !['http:', 'https:'].includes(url.protocol) || media.mediaType === 'video') {
        throw new BadRequestException('Upload room photos before saving');
      }
      if (seen.has(url.href)) throw new BadRequestException('Room photos must be different files');
      seen.add(url.href);
      const storage = this.storage();
      const prefix = storage.getPublicUrl(`${agentId}/`).data.publicUrl;
      const name = media.mediaUrl.slice(prefix.length);
      if (!media.mediaUrl.startsWith(prefix) || !IMAGE_NAME.test(name)) {
        throw new BadRequestException('Upload room photos before saving');
      }
      const { data, error } = await storage.exists(`${agentId}/${name}`);
      if (error) throw new ServiceUnavailableException('Unable to verify room photo; please try again');
      if (!data) throw new BadRequestException('Uploaded photo no longer exists; upload it again');
    }
  }
}
