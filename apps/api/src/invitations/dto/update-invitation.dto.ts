import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { INVITATION_SLUG_PATTERN } from './create-invitation.dto';

export class UpdateInvitationDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(255)
  @Matches(INVITATION_SLUG_PATTERN, {
    message: 'slug may contain lowercase letters, numbers, and single hyphens only.',
  })
  slug?: string;
}
