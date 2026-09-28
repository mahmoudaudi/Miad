import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class GenerateInvitationDesignDto {
  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  prompt!: string;

  /**
   * Stable key for one logical AI request. Sending the same key again (a retry
   * or a double click) reuses the existing reservation instead of charging
   * twice. Omit it to get a fresh single-use reservation.
   */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(['generate', 'regenerate'])
  mode?: 'generate' | 'regenerate';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelPreference?: string;
}

export class RefineInvitationDesignDto {
  @Transform(trim)
  @IsString()
  @Length(3, 1000)
  instruction!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelPreference?: string;
}
