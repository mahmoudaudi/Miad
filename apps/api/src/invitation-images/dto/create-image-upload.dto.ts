import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_IMAGE_FILE_BYTES } from '../invitation-image-validation';

export class CreateImageUploadDto {
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
  @Max(MAX_IMAGE_FILE_BYTES)
  fileSize!: number;
}
