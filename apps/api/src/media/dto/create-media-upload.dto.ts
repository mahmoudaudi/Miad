import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_MEDIA_FILE_BYTES } from '../media-validation';

export class CreateMediaUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fileType!: string;

  @IsInt()
  @Min(1)
  @Max(MAX_MEDIA_FILE_BYTES)
  fileSize!: number;
}
