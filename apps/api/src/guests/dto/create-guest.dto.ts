import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { nullableEmail, nullableTrim, trim } from './guest-transforms';
import { RSVP_STATUSES } from './create-rsvp.dto';

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

  @IsOptional()
  @IsIn(RSVP_STATUSES)
  status?: (typeof RSVP_STATUSES)[number];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  partySize?: number;

  @Transform(nullableTrim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
