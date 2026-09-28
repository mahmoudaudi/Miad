import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';

class GeneratedProjectFileDto {
  @IsIn(['index.html', 'styles.css'])
  path!: 'index.html' | 'styles.css';

  @IsString()
  @MaxLength(30_000)
  content!: string;
}

class GeneratedProjectDto {
  @IsString()
  @Length(1, 120)
  name!: string;

  @IsString()
  @Length(1, 300)
  description!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => GeneratedProjectFileDto)
  files!: GeneratedProjectFileDto[];
}

export class RefineAiStudioDto {
  @IsUUID()
  @IsOptional()
  generationId?: string;

  @IsUUID()
  invitationId!: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 1000)
  prompt!: string;

  // The client sends the project it is displaying. The server deliberately
  // uses its owned active version as the refinement source instead.
  @IsObject()
  @ValidateNested()
  @Type(() => GeneratedProjectDto)
  website!: GeneratedProjectDto;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  modelPreference?: string;

  /** Stable key for one logical AI request; reuse it to avoid double charging. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(120)
  idempotencyKey?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsUUID('4', { each: true })
  imageIds?: string[];
}
