import { Type } from 'class-transformer';
import { IsDate, IsIn, IsOptional } from 'class-validator';

export class AdminAnalyticsQueryDto {
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  range?: '7d' | '30d' | '90d' = '30d';

  /** Custom window overrides range when both are valid ISO dates. */
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;
}
