import { BadRequestException } from '@nestjs/common';

export function contractAmount(value: string, label: string, positive = false): number {
  const raw = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(raw)) throw new BadRequestException(`${label}ต้องเป็นจำนวนเงินที่ถูกต้อง`);
  const amount = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount >= 1e10 || (positive && amount <= 0)) throw new BadRequestException(`${label}ไม่อยู่ในช่วงที่รองรับ`);
  return amount;
}
