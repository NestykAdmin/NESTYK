import { BadRequestException } from '@nestjs/common';
import sharp from 'sharp';

const MAX_SIGNATURE_BYTES = 2 * 1024 * 1024;
const MAX_SIGNATURE_DIMENSION = 4096;

/** Decode before committing a signature, and normalize to a PNG the PDF renderer can read. */
export async function validateSignaturePng(png: Buffer): Promise<Buffer> {
  if (png.length < 32 || png.length > MAX_SIGNATURE_BYTES || png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') {
    throw new BadRequestException('ลายเซ็นต้องเป็นไฟล์ PNG ไม่เกิน 2 MB');
  }
  try {
    const image = sharp(png, { limitInputPixels: MAX_SIGNATURE_DIMENSION ** 2, failOn: 'warning' });
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > MAX_SIGNATURE_DIMENSION || metadata.height > MAX_SIGNATURE_DIMENSION || (metadata.pages ?? 1) !== 1) {
      throw new Error('Invalid signature dimensions');
    }
    const decoded = await image.png().toBuffer();
    if (decoded.length > MAX_SIGNATURE_BYTES) throw new Error('Signature too large');
    return decoded;
  } catch {
    throw new BadRequestException('ไม่สามารถอ่านภาพลายเซ็น PNG ได้ กรุณาวาดลายเซ็นใหม่');
  }
}
