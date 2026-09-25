import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const DEFAULT_MEDIA_PAGE_SIZE = 24;
export const MAX_MEDIA_PAGE_SIZE = 48;

export class ListMediaQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_MEDIA_PAGE_SIZE)
  limit?: number = DEFAULT_MEDIA_PAGE_SIZE;
}
