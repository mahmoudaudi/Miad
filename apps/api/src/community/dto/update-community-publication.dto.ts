import { IsBoolean } from 'class-validator';

export class UpdateCommunityPublicationDto {
  @IsBoolean()
  published!: boolean;
}
