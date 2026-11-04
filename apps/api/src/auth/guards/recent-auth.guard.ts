import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { recentlyAuthenticated } from '../recent-auth';

/**
 * Use after AuthGuard (which verifies the token): 401 REAUTH_REQUIRED unless the bearer token authenticated in the
 * last 5 minutes. The app then asks for the password again (QA: account deletion, 3 Nov 2026).
 */
@Injectable()
export class RecentAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined> }>();
    const header = request.headers.authorization ?? request.headers.Authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : '';
    if (!token || !recentlyAuthenticated(token)) {
      throw new UnauthorizedException({ code: 'REAUTH_REQUIRED', message: 'Confirm your identity again' });
    }
    return true;
  }
}
