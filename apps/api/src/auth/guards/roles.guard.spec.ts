import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

function makeGuard(requiredRoles: string[] | undefined, role: string | undefined) {
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  } as never;
  return new RolesGuard(reflector).canActivate(context);
}

describe('RolesGuard (admin API authorization)', () => {
  it('allows an admin session to reach admin endpoints', () => {
    expect(makeGuard(['admin'], 'admin')).toBe(true);
  });

  it('rejects a normal user session on admin endpoints with 403', () => {
    expect(() => makeGuard(['admin'], 'user')).toThrow(ForbiddenException);
  });

  it('rejects a missing role on admin endpoints with 403', () => {
    expect(() => makeGuard(['admin'], undefined)).toThrow(ForbiddenException);
  });

  it('allows routes without role metadata', () => {
    expect(makeGuard(undefined, 'user')).toBe(true);
    expect(makeGuard([], 'user')).toBe(true);
  });
});
