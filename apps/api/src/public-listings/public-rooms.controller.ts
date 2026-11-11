import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { PublicRoomsService } from './public-rooms.service';

/**
 * Short shared cache for the guest web (Mos 11 Nov 2026, H8): browsers keep a minute, a CDN five minutes.
 * The API has no rate limit; the cache and the page-size caps keep repeated calls cheap. Edge rate limiting is
 * set where the API is hosted.
 */
export const PUBLIC_CACHE_CONTROL = 'public, max-age=60, s-maxage=300, stale-while-revalidate=600';

/** Public rooms for the guest web. No sign-in: there is deliberately no guard on these controllers. */
@Controller('public/rooms')
export class PublicRoomsController {
  constructor(private readonly rooms: PublicRoomsService) {}

  @Get('featured')
  @Header('Cache-Control', PUBLIC_CACHE_CONTROL)
  featured(@Query('rail') rail?: string, @Query('limit') limit?: string) {
    return this.rooms.featured(rail, limit);
  }

  @Get(':id')
  @Header('Cache-Control', PUBLIC_CACHE_CONTROL)
  detail(@Param('id') id: string) {
    return this.rooms.detail(id);
  }
}

@Controller('public/areas')
export class PublicAreasController {
  constructor(private readonly rooms: PublicRoomsService) {}

  @Get()
  @Header('Cache-Control', PUBLIC_CACHE_CONTROL)
  list(@Query('limit') limit?: string) {
    return this.rooms.areas(limit);
  }
}
