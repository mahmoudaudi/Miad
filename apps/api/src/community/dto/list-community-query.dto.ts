import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ListCommunityQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  search?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  category?: string;
}
