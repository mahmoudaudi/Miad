import { IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';
import { MAX_IMAGE_FILE_BYTES } from '../invitation-image-validation';

/** Re-declared at completion; the server re-validates everything before persistence. */
export class CompleteImageUploadDto {
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
