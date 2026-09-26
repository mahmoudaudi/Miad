import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class SmartAnswerDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(64)
  @Matches(/^[a-z0-9][a-z0-9-]*$/i)
  questionId!: string;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    if (value === undefined || value === null) return null;
    if (Array.isArray(value)) {
      return value
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter((item): item is string => item.length > 0)
        .slice(0, 6)
        .map((item) => item.slice(0, 120));
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed ? trimmed.slice(0, 120) : null;
    }
    return null;
  })
  @IsOptional()
  @IsString({ each: false })
  @MaxLength(120, { each: false })
  value!: string | string[] | null;
}

export class AnalyzeAiStudioDto {
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3)
  @MaxLength(2000)
  prompt!: string;

  /** Everything gathered so far, client-held. Validated as plain data only. */
  @IsOptional()
  @IsObject()
  collectedData?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SmartAnswerDto)
  answers?: SmartAnswerDto[];

  @IsOptional()
  @IsString()
  @MaxLength(64)
  lastQuestionId?: string;
}
