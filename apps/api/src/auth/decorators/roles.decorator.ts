import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Usage: @Roles('admin') — checked by RolesGuard after JwtAuthGuard. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
