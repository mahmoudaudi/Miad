import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdminInvitationsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @IsOptional()
  @IsIn(['PUBLISHED', 'DRAFT'])
  status?: 'PUBLISHED' | 'DRAFT';

  @IsOptional()
  @IsString()
  @MaxLength(100)
  eventType?: string;

  @IsOptional()
  @IsIn(['7d', '30d'])
  created?: '7d' | '30d';

  @IsOptional()
  @IsIn(['newest', 'mostViewed', 'mostRsvps'])
  sort?: 'newest' | 'mostViewed' | 'mostRsvps' = 'newest';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 6;
}
