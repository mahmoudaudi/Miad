import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class GenerateInvitationDesignDto {
  @Transform(trim)
  @IsString()
  @Length(10, 2000)
  prompt!: string;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(['generate', 'regenerate'])
  mode?: 'generate' | 'regenerate';
}

export class RefineInvitationDesignDto {
  @Transform(trim)
  @IsString()
  @Length(3, 1000)
  instruction!: string;
}
