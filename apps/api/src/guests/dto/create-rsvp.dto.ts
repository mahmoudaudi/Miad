import { Transform, Type } from 'class-transformer';
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

export const RSVP_STATUSES = ['ATTENDING', 'PENDING', 'NOT_ATTENDING'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export class CreateRsvpDto {
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

  @IsString()
  @IsIn(RSVP_STATUSES)
  status!: RsvpStatus;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(20)
  attendeesCount!: number;

  @Transform(nullableTrim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string | null;
}
