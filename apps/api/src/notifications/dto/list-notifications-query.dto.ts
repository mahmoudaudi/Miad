import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export const DEFAULT_NOTIFICATIONS_PAGE_SIZE = 24;
export const MAX_NOTIFICATIONS_PAGE_SIZE = 50;

export class ListNotificationsQueryDto {
  @IsOptional()
  @IsUUID()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_NOTIFICATIONS_PAGE_SIZE)
  limit?: number = DEFAULT_NOTIFICATIONS_PAGE_SIZE;
}

/** Empty body DTO: any client-supplied field (userId, type, …) is rejected. */
export class NotificationActionBodyDto {}
