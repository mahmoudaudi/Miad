import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class AdminUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  /** Plan name as stored, or 'Free' for users without an active subscription. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  plan?: string;

  @IsOptional()
  @IsIn(['active', 'suspended'])
  status?: 'active' | 'suspended';

  @IsOptional()
  @IsIn(['7d', '30d'])
  joined?: '7d' | '30d';

  @IsOptional()
  @IsIn(['newest', 'invitations', 'aiRuns'])
  sort?: 'newest' | 'invitations' | 'aiRuns' = 'newest';

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
  limit?: number = 8;
}
