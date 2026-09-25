import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { EVENT_DATE_PATTERN, EVENT_TIME_PATTERN } from './create-event.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

const nullableTrim = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const nullableNumber = ({ value }: { value: unknown }) => {
  if (value === '' || value === null || value === undefined) return null;
  return typeof value === 'number' ? value : Number(value);
};

export class UpdateEventDto {
  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  eventType?: string;

  @Transform(nullableTrim)
  @IsOptional()
  @IsString()
  description?: string | null;

  @Transform(trim)
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(EVENT_DATE_PATTERN, { message: 'eventDate must use YYYY-MM-DD.' })
  eventDate?: string;

  @Transform(nullableTrim)
  @IsOptional()
  @IsString()
  @Matches(EVENT_TIME_PATTERN, { message: 'startTime must use HH:mm.' })
  startTime?: string | null;

  @Transform(nullableTrim)
  @IsOptional()
  @IsString()
  @Matches(EVENT_TIME_PATTERN, { message: 'endTime must use HH:mm.' })
  endTime?: string | null;

  @Transform(nullableTrim)
  @IsOptional()
  @IsString()
  @MaxLength(255)
  venueName?: string | null;

  @Transform(nullableTrim)
  @IsOptional()
  @IsString()
  venueAddress?: string | null;

  @Transform(nullableNumber)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude?: number | null;

  @Transform(nullableNumber)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude?: number | null;
}
