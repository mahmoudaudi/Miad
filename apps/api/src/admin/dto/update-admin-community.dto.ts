import { IsBoolean } from 'class-validator';

export class UpdateAdminCommunityPublicationDto {
  @IsBoolean()
  isPublished!: boolean;
}
