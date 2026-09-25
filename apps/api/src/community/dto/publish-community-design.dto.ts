import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class PublishCommunityDesignDto {
  @IsString()
  @Length(2, 120)
  title!: string;

  @IsString()
  @Length(2, 500)
  description!: string;

  @IsString()
  @Length(2, 50)
  category!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  slug?: string;
}
