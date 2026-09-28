import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { nullableTrim, trim } from './guest-transforms';

export const RSVP_STATUSES = ['ATTENDING', 'PENDING', 'NOT_ATTENDING'] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];
export const PUBLIC_RSVP_STATUSES = ['ATTENDING', 'NOT_ATTENDING'] as const;
export type PublicRsvpStatus = (typeof PUBLIC_RSVP_STATUSES)[number];

export class CreateRsvpDto {
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsIn(PUBLIC_RSVP_STATUSES)
  status!: PublicRsvpStatus;

  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(20)
  attendeesCount?: number;

  @Transform(nullableTrim)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string | null;
}
