import { Transform } from 'class-transformer';
import { IsBoolean, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateAdminUserStatusDto {
  @IsBoolean()
  isActive!: boolean;
}

export class UpdateAdminUserRoleDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  role!: string;
}
