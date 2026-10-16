import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../auth/guards/auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { CurrentUser, AuthRequestUser } from '../../auth/decorators/current-user.decorator';
import { DatabaseIdPipe } from '../../common/database-id.pipe';
import { ContractArchiveService } from './contract-archive.service';

@Controller('agent/contract-archive')
@UseGuards(AuthGuard, RolesGuard)
@Roles('agent')
export class ContractArchiveController {
  constructor(private readonly archive: ContractArchiveService) {}
  @Get()
  list(@CurrentUser() user: AuthRequestUser, @Query() query: Record<string, unknown>) { return this.archive.list(user.id, query); }
  @Get(':kind/:id')
  detail(@CurrentUser() user: AuthRequestUser, @Param('kind') kind: string, @Param('id', DatabaseIdPipe) id: number) {
    return this.archive.detail(user.id, kind, id);
  }
}
