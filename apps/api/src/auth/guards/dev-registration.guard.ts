import { CanActivate, ExecutionContext, Injectable, NotFoundException } from '@nestjs/common';

export function devRegistrationEnabled(): boolean {
  return process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_REGISTRATION === 'true';
}

function localUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
      !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash;
  } catch {
    return false;
  }
}

/** A direct loopback-only development route; never trust proxy headers to identify a tester. */
@Injectable()
export class DevRegistrationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      socket?: { remoteAddress?: string };
      headers: Record<string, string | string[] | undefined>;
    }>();
    const { headers } = request;
    const host = headers.host;
    const origin = headers.origin;
    const proxied = ['forwarded', 'x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto']
      .some(header => headers[header] !== undefined);
    if (!devRegistrationEnabled() ||
        !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(request.socket?.remoteAddress ?? '') ||
        proxied || headers['sec-fetch-site'] === 'cross-site' ||
        typeof host !== 'string' || !localUrl(`http://${host}`) ||
        (origin !== undefined && (typeof origin !== 'string' || !localUrl(origin)))) {
      throw new NotFoundException({ code: 'TEST_REGISTRATION_UNAVAILABLE', message: 'Test registration is unavailable' });
    }
    return true;
  }
}
