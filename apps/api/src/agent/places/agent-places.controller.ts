import { SingleQueryPipe } from '../../common/single-query.pipe';
import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { AgentPlacesService } from './agent-places.service';

@Controller('agent/places')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent', 'owner')
export class AgentPlacesController {
  constructor(private readonly placesService: AgentPlacesService) {}

  @Get('autocomplete')
  autocomplete(
    @Query('q', SingleQueryPipe) q?: string,
    @Query('language', SingleQueryPipe) language?: string,
  ) {
    return this.placesService.autocomplete(this.singleQuery(q, 'q') ?? '', this.normalizeLanguage(language));
  }

  @Get('nearby')
  nearby(@Query('latitude', SingleQueryPipe) latitude?: string, @Query('longitude', SingleQueryPipe) longitude?: string, @Query('language', SingleQueryPipe) language?: string) {
    return this.placesService.nearby(this.coordinate(latitude, 'latitude'), this.coordinate(longitude, 'longitude'), this.normalizeLanguage(language));
  }

  @Get('reverse')
  reverse(@Query('latitude', SingleQueryPipe) latitude?: string, @Query('longitude', SingleQueryPipe) longitude?: string) {
    return this.placesService.reverse(this.coordinate(latitude, 'latitude'), this.coordinate(longitude, 'longitude'));
  }

  @Get('details')
  details(
    @Query('placeId', SingleQueryPipe) placeId?: string,
    @Query('language', SingleQueryPipe) language?: string,
  ) {
    return this.placesService.details(this.singleQuery(placeId, 'placeId') ?? '', this.normalizeLanguage(language));
  }

  private normalizeLanguage(language?: string): string {
    const value = (this.singleQuery(language, 'language') || 'th').toLowerCase().slice(0, 2);
    if (value === 'en' || value === 'zh' || value === 'ja' || value === 'th') {
      return value;
    }
    return 'th';
  }

  private singleQuery(value: unknown, name: string): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') throw new BadRequestException(`${name} must be a single string`);
    return value;
  }

  private coordinate(value: unknown, name: string): number {
    const text = this.singleQuery(value, name);
    return text?.trim() ? Number(text) : NaN;
  }
}
