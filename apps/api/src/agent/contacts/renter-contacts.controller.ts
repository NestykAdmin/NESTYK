import { SingleQueryPipe } from '../../common/single-query.pipe';
import { contactPageOptions } from './contact-pagination';
import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { DatabaseIdPipe } from '../../common/database-id.pipe';
import { RenterContactsService, renterContactKind } from './renter-contacts.service';

@Controller('agent/contacts')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class RenterContactsController {
  constructor(private readonly contacts: RenterContactsService) {}
  @Get(':kind')
  list(@CurrentUser() user: AuthRequestUser, @Param('kind') kind: string, @Query(new SingleQueryPipe()) query: Record<string, unknown>) {
    return this.contacts.list(user.id, renterContactKind(kind), contactPageOptions(query));
  }
  @Get(':kind/:id')
  get(@CurrentUser() user: AuthRequestUser, @Param('kind') kind: string, @Param('id', DatabaseIdPipe) id: number) {
    return this.contacts.get(user.id, renterContactKind(kind), id);
  }
  @Patch(':kind/:id')
  update(@CurrentUser() user: AuthRequestUser, @Param('kind') kind: string, @Param('id', DatabaseIdPipe) id: number, @Body() input: unknown) {
    return this.contacts.update(user.id, renterContactKind(kind), id, input);
  }
}
