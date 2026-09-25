import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export const INVITATION_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class CreateInvitationDto {
  @IsUUID()
  eventId!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  @Matches(INVITATION_SLUG_PATTERN, {
    message: 'slug may contain lowercase letters, numbers, and single hyphens only.',
  })
  slug!: string;
}
