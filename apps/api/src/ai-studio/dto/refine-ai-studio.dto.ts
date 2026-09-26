import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsObject,
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
}
