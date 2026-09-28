import { Type, Transform } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  Matches,
  Max,
  Min,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { invitationThemeIds, InvitationThemeId } from './set-invitation-design.dto';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const normalizeColor = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

export class InvitationContentDto {
  @Transform(trim)
  @IsString()
  @Length(1, 80)
  eyebrow!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 100)
  dateLine!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 160)
  venueLine!: string;
}

export class InvitationColorsDto {
  @Transform(normalizeColor)
  @Matches(/^#[0-9A-F]{6}$/)
  background!: string;

  @Transform(normalizeColor)
  @Matches(/^#[0-9A-F]{6}$/)
  surface!: string;

  @Transform(normalizeColor)
  @Matches(/^#[0-9A-F]{6}$/)
  text!: string;

  @Transform(normalizeColor)
  @Matches(/^#[0-9A-F]{6}$/)
  accent!: string;
}

export class InvitationTypographyDto {
  @IsIn(['Playfair Display', 'Inter'])
  headingFamily!: 'Playfair Display' | 'Inter';

  @IsIn(['Playfair Display', 'Inter'])
  bodyFamily!: 'Playfair Display' | 'Inter';
}

export class InvitationLayoutDto {
  @IsIn(['center', 'left'])
  alignment!: 'center' | 'left';

  @IsIn(['airy', 'compact'])
  density!: 'airy' | 'compact';
}

export class InvitationSectionDto {
  @Transform(trim)
  @IsString()
  @Length(1, 64)
  id!: string;

  @IsIn(['hero', 'details', 'story', 'schedule', 'rsvp', 'note'])
  type!: 'hero' | 'details' | 'story' | 'schedule' | 'rsvp' | 'note';

  @Transform(trim)
  @IsString()
  @Length(1, 120)
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(1, 500)
  body!: string;

  @IsInt()
  @Min(0)
  @Max(20)
  order!: number;

  @IsBoolean()
  visible!: boolean;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 32)
  variant?: string;
}

export class InvitationElementDto {
  @Transform(trim)
  @IsString()
  @Length(1, 64)
  id!: string;

  @IsIn(['text', 'image', 'section'])
  type!: 'text' | 'image' | 'section';

  @Transform(trim)
  @IsString()
  @Length(1, 80)
  label!: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 300)
  text?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 1000)
  @Matches(/^(https?:\/\/\S+|(?:image|media):\/\/[0-9a-fA-F-]{36})$/, {
    message: 'imageUrl must be an http(s) URL or an invitation image reference.',
  })
  imageUrl?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  x!: number;

  @IsInt()
  @Min(0)
  @Max(100)
  y!: number;

  @IsInt()
  @Min(8)
  @Max(100)
  width!: number;

  @IsInt()
  @Min(4)
  @Max(100)
  height!: number;

  @IsInt()
  @Min(10)
  @Max(96)
  fontSize!: number;

  @Transform(normalizeColor)
  @Matches(/^#[0-9A-F]{6}$/)
  color!: string;

  @IsOptional()
  @Transform(normalizeColor)
  @Matches(/^#[0-9A-F]{6}$/)
  backgroundColor?: string;
}

export class UpdateInvitationDesignDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsIn(invitationThemeIds)
  theme?: InvitationThemeId;

  @IsOptional()
  @ValidateNested()
  @Type(() => InvitationContentDto)
  content?: InvitationContentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InvitationColorsDto)
  colors?: InvitationColorsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InvitationTypographyDto)
  typography?: InvitationTypographyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InvitationLayoutDto)
  layout?: InvitationLayoutDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvitationSectionDto)
  sections?: InvitationSectionDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InvitationElementDto)
  elements?: InvitationElementDto[];
}
