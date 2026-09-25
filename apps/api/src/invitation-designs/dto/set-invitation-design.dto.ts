import { Transform } from 'class-transformer';
import { IsIn } from 'class-validator';

export const invitationThemeIds = [
  'classic-ivory',
  'modern-contrast',
  'romantic-blush',
  'midnight-onyx',
  'sage-garden',
  'ocean-pearl',
  'terracotta-fiesta',
  'lavender-mist',
  'emerald-evening',
] as const;

export type InvitationThemeId = (typeof invitationThemeIds)[number];

export class SetInvitationDesignDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(invitationThemeIds)
  theme!: InvitationThemeId;
}
