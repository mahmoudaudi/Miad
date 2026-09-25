import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { nullableEmail, nullableTrim, trim } from './guest-transforms';

export class CreateGuestDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

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
