import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard, JwtIdentity } from './guards/auth.guard';
import { CurrentUser, AuthRequestUser } from './decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('sync')
  @UseGuards(AuthGuard)
  async sync(
    @Req()
    req: {
      authIdentity?: JwtIdentity;
      user?: AuthRequestUser;
    },
  ) {
    const identity = req.authIdentity;
    if (!identity) {
      throw new UnauthorizedException('Missing auth identity');
    }
    return this.authService.sync(identity);
  }

  @Patch('profile')
  @UseGuards(AuthGuard)
  async updateProfile(
    @CurrentUser() user: AuthRequestUser,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
    },
  ) {
    this.requireUser(user);
    return this.authService.updateProfile(user.id, body);
  }

  @Post('profile/avatar')
  @UseGuards(AuthGuard)
  async updateAvatar(
    @CurrentUser() user: AuthRequestUser,
    @Body() body: { avatarUrl?: string },
  ) {
    this.requireUser(user);
    if (!body?.avatarUrl) {
      throw new BadRequestException('avatarUrl is required');
    }
    return this.authService.updateAvatar(user.id, body.avatarUrl);
  }

  @Post('dev/roles')
  @UseGuards(AuthGuard)
  async grantDevRole(
    @CurrentUser() user: AuthRequestUser,
    @Body() body: { role?: string },
  ) {
    this.requireUser(user);
    if (!body?.role) {
      throw new BadRequestException('role is required');
    }
    return this.authService.grantDevRole(user.id, body.role);
  }

  @Delete('dev/roles')
  @UseGuards(AuthGuard)
  async revokeDevRole(
    @CurrentUser() user: AuthRequestUser,
    @Body() body: { role?: string },
  ) {
    this.requireUser(user);
    if (!body?.role) {
      throw new BadRequestException('role is required');
    }
    return this.authService.revokeDevRole(user.id, body.role);
  }

  private requireUser(user: AuthRequestUser | undefined): asserts user is AuthRequestUser {
    if (!user?.id) {
      throw new UnauthorizedException('Call POST /auth/sync first');
    }
  }
}
