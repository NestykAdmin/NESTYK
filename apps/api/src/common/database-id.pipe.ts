import { ArgumentMetadata, BadRequestException, Injectable, ParseIntPipe } from '@nestjs/common';

export function isDatabaseId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 2147483647;
}

/** PostgreSQL serial/int identifiers must be checked before reaching a query. */
@Injectable()
export class DatabaseIdPipe extends ParseIntPipe {
  async transform(value: string, metadata: ArgumentMetadata): Promise<number> {
    const id = await super.transform(value, metadata);
    if (!isDatabaseId(id)) throw new BadRequestException('ID must be an integer between 1 and 2147483647');
    return id;
  }
}
