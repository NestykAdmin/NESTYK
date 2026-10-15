import { SingleQueryPipe } from '../../common/single-query.pipe';
import { DatabaseIdPipe } from '../../common/database-id.pipe';
import { Controller, Get, Param, Query, UnauthorizedException, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { AgentListingsService } from './agent-listings.service';

@Controller('agent/listings')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class AgentListingsController {
  constructor(private readonly listingsService: AgentListingsService) {}

  @Get(':id')
  view(@CurrentUser() user: AuthRequestUser, @Param('id', DatabaseIdPipe) id: number) {
    return this.listingsService.viewMine(user.id, id);
  }

  @Get()
  list(
    @CurrentUser() user: AuthRequestUser,
    @Query('page', SingleQueryPipe) page?: string,
    @Query('limit', SingleQueryPipe) limit?: string,
    @Query('q', SingleQueryPipe) q?: string,
    @Query('visibility', SingleQueryPipe) visibility?: string,
    @Query('roomStatus', SingleQueryPipe) roomStatus?: string,
    @Query('listingSource', SingleQueryPipe) listingSource?: string,
    @Query('sort', SingleQueryPipe) sort?: string,
    @Query('propertyType', SingleQueryPipe) propertyType?: string,
    @Query('roomType', SingleQueryPipe) roomType?: string,
    @Query('bedrooms', SingleQueryPipe) bedrooms?: string,
    @Query('minPrice', SingleQueryPipe) minPrice?: string,
    @Query('maxPrice', SingleQueryPipe) maxPrice?: string,
  ) {
    if (!user?.id) {
      throw new UnauthorizedException('Call POST /auth/sync first');
    }
    return this.listingsService.listMine(user.id, {
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
      q,
      visibility,
      roomStatus,
      listingSource,
      sort,
      propertyType, roomType, bedrooms, minPrice, maxPrice,
    });
  }
}
