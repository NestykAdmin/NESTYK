import { BadRequestException } from '@nestjs/common';
import { isDatabaseId } from '../../common/database-id.pipe';

type ObjectInput = Record<string, unknown>;
function object(value: unknown, name: string): ObjectInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException(`${name} must be an object`);
  return value as ObjectInput;
}
function strings(row: ObjectInput, fields: Record<string, number>, name: string) {
  for (const [key, max] of Object.entries(fields)) {
    if (row[key] !== undefined && (typeof row[key] !== 'string' || (row[key] as string).length > max)) {
      throw new BadRequestException(`${name}.${key} must be text up to ${max} characters`);
    }
  }
}
function id(row: ObjectInput, key: string, name: string) {
  if (row[key] !== undefined && !isDatabaseId(row[key])) throw new BadRequestException(`${name}.${key} must be a valid ID`);
}
function rows(row: ObjectInput, key: string): ObjectInput[] {
  if (row[key] === undefined) return [];
  if (!Array.isArray(row[key])) throw new BadRequestException(`${key} must be an array`);
  return (row[key] as unknown[]).map((v) => object(v, key));
}

/** Validate JSON types before existing business rules or database queries run. */
export function validateRoomInput(input: unknown) {
  const body = object(input, 'body');
  strings(body, { listingTitle: 255, promoTitle: 255, listingDescription: 10000, roomId: 100, nearbyOther: 500 }, 'body');
  for (const key of ['contactId', 'propertyId', 'roomTypeId']) id(body, key, 'body');
  if (body.contactIds !== undefined && (!Array.isArray(body.contactIds) || !body.contactIds.every(isDatabaseId))) {
    throw new BadRequestException('contactIds must contain valid IDs');
  }
  const contacts = rows(body, 'contacts');
  if (body.contact !== undefined) contacts.push(object(body.contact, 'contact'));
  for (const contact of contacts) {
    strings(contact, { name: 255, phone: 50, email: 255, lineId: 100, facebook: 255, note: 500 }, 'contact');
  }
  if (body.property !== undefined) {
    const property = object(body.property, 'property');
    strings(property, { name: 255, address: 10000, subdistrict: 255, district: 255, province: 255, postalCode: 10 }, 'property');
    id(property, 'propertyTypeId', 'property');
    for (const [key, max] of [['latitude', 90], ['longitude', 180]] as const) {
      if (property[key] !== undefined && (typeof property[key] !== 'number' || !Number.isFinite(property[key]) || Math.abs(property[key] as number) > max)) {
        throw new BadRequestException(`property.${key} is invalid`);
      }
    }
  }
  for (const price of rows(body, 'prices')) {
    id(price, 'contractTypeId', 'prices');
    if (typeof price.price !== 'number' || !Number.isFinite(price.price) || price.price <= 0 || price.price >= 1e10) throw new BadRequestException('price must be a positive amount below 10000000000');
  }
  for (const layout of rows(body, 'layout')) strings(layout, { code: 64, value: 64 }, 'layout');
  rows(body, 'facilities');
  for (const document of rows(body, 'documents')) {
    if (document.sortOrder !== undefined && (typeof document.sortOrder !== 'number' || !Number.isInteger(document.sortOrder) || document.sortOrder < 0 || document.sortOrder > 2147483647)) throw new BadRequestException('Invalid document sortOrder');
  }
  for (const media of rows(body, 'medias')) {
    strings(media, { mediaUrl: 500 }, 'medias');
    if (media.mediaType !== undefined && !['image', 'video'].includes(media.mediaType as string)) throw new BadRequestException('Invalid mediaType');
    if (media.category !== undefined && !['room', 'common', 'floorplan'].includes(media.category as string)) throw new BadRequestException('Invalid media category');
    if (media.isCover !== undefined && typeof media.isCover !== 'boolean') throw new BadRequestException('isCover must be boolean');
    if (media.sortOrder !== undefined && (typeof media.sortOrder !== 'number' || !Number.isInteger(media.sortOrder) || media.sortOrder < 0 || media.sortOrder > 2147483647)) throw new BadRequestException('Invalid media sortOrder');
  }
  for (const key of ['waterRatePerUnit', 'electricRatePerUnit']) {
    if (body[key] != null && (typeof body[key] !== 'number' || !Number.isFinite(body[key]) || (body[key] as number) <= 0 || (body[key] as number) >= 1e10)) throw new BadRequestException(`${key} must be a positive amount below 10000000000`);
  }
}
