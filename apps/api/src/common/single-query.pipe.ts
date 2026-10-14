import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

@Injectable()
export class SingleQueryPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (metadata.data === undefined) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('Invalid query');
      for (const [key, item] of Object.entries(value)) this.single(item, key);
      return value;
    }
    return this.single(value, metadata.data);
  }

  private single(value: unknown, name: string) {
    if (value !== undefined && typeof value !== 'string') throw new BadRequestException(`${name} must be a single string`);
    return value;
  }
}
