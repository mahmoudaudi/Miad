import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class RecordViewDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  sessionIdentifier?: string;

  @IsOptional()
  @IsIn(['desktop', 'tablet', 'mobile', 'unknown'])
  deviceType?: string;
}
