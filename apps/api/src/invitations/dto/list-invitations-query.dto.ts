import { IsOptional, IsUUID } from 'class-validator';

export class ListInvitationsQueryDto {
  @IsOptional()
  @IsUUID()
  eventId?: string;
}
