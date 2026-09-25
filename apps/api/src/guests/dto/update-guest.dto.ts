import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';
import { nullableEmail, nullableTrim, trim } from './guest-transforms';

export class UpdateGuestDto {
  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name?: string;

  @Transform(nullableEmail)
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string | null;

  @Transform(nullableTrim)
  @IsOptional()
  @IsString()
  @MaxLength(50)
  phone?: string | null;
}
