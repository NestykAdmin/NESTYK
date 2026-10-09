import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "../../auth/guards/auth.guard";
import { RolesGuard } from "../../auth/guards/roles.guard";
import { Roles } from "../../auth/decorators/roles.decorator";
import {
  CurrentUser,
  AuthRequestUser,
} from "../../auth/decorators/current-user.decorator";
import { AgentTenantsService } from "./agent-tenants.service";

/** Optional numeric query parameter; anything else is ignored. */
function positiveId(value?: string): number | undefined {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : undefined;
}
@Controller("agent/tenants")
@UseGuards(AuthGuard, RolesGuard)
@Roles("agent")
export class AgentTenantsController {
  constructor(private readonly tenants: AgentTenantsService) {}
  @Get("leads") leads(
    @CurrentUser() u: AuthRequestUser,
    @Query("q") q?: string,
  ) {
    return this.tenants.leadOptions(u.id, q);
  }
  @Get("rooms") rooms(
    @CurrentUser() u: AuthRequestUser,
    @Query("q") q?: string,
    @Query("leadId") leadId?: string,
    @Query("roomId") roomId?: string,
  ) {
    return this.tenants.roomOptions(u.id, q, {
      leadId: positiveId(leadId),
      roomId: positiveId(roomId),
    });
  }
  @Get() list(@CurrentUser() u: AuthRequestUser) {
    return this.tenants.list(u.id);
  }
  @Get(":id") view(
    @CurrentUser() u: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
  ) {
    return this.tenants.view(u.id, id);
  }
  @Post() create(@CurrentUser() u: AuthRequestUser, @Body() body: unknown) {
    return this.tenants.create(u.id, body);
  }
  @Patch(":id") update(
    @CurrentUser() u: AuthRequestUser,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: unknown,
  ) {
    return this.tenants.update(u.id, id, body);
  }
}
