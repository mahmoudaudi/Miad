import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import type { SafeUser } from '../auth.service';

export type AuthPayload = { sub: string; email: string; role: string; v: number };

/**
 * Accepts access JWT from httpOnly cookie (web) or Bearer header (API clients).
 * Verifies signature AND that the token version matches the DB (logout bumps
 * tokenVersion, instantly invalidating all previously issued tokens).
 *
 * This guard performs the request's single user lookup (indexed PK + role
 * join) and attaches both the minimal AuthPayload (`req.user`, used for
 * ownership and role checks) and the display-safe user (`req.authUser`, used
 * by GET /auth/me). Downstream handlers must NOT re-fetch the same user —
 * each extra query costs a full pooler roundtrip.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token: string | undefined =
      req.cookies?.access_token ?? this.bearer(req.headers?.authorization);
    if (!token) throw new UnauthorizedException('Authentication required.');
    try {
      const payload = await this.jwt.verifyAsync<AuthPayload>(token, {
        secret: this.config.getOrThrow<string>('JWT_ACCESS_SECRET'),
      });
      if (
        typeof payload.sub !== 'string' ||
        !payload.sub ||
        typeof payload.v !== 'number' ||
        !Number.isInteger(payload.v) ||
        payload.v < 0
      ) {
        throw new UnauthorizedException('Invalid or expired session.');
      }
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          tokenVersion: true,
          role: { select: { name: true } },
        },
      });
      if (!user || !user.isActive || user.tokenVersion !== payload.v) {
        throw new UnauthorizedException('Invalid or expired session.');
      }
      // Authorization uses the current database role, not a potentially stale
      // role claim from a previously issued token.
      req.user = { ...payload, role: user.role.name };
      req.authUser = {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role.name,
        isActive: user.isActive,
      } satisfies SafeUser;
      return true;
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException('Invalid or expired session.');
    }
  }

  private bearer(header: string | undefined): string | undefined {
    if (!header) return undefined;
    const [scheme, token] = header.split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : undefined;
  }
}
