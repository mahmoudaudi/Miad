import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { AuthPayload } from '../guards/jwt-auth.guard';
import type { SafeUser } from '../auth.service';

export type { AuthPayload };

/** Usage: me(@CurrentUser() user: AuthPayload) */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPayload => {
    return ctx.switchToHttp().getRequest().user;
  }
);

/**
 * The display-safe user attached by JwtAuthGuard from its single user lookup.
 * Controllers must prefer this over re-querying the same row.
 */
export const CurrentAuthUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SafeUser => {
    const authUser: SafeUser | undefined = ctx.switchToHttp().getRequest().authUser;
    if (!authUser) throw new UnauthorizedException('Invalid or expired session.');
    return authUser;
  }
);
