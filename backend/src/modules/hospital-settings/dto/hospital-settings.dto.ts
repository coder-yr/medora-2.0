import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsBoolean,
  IsEmail,
  Matches,
  MaxLength,
  IsObject,
  IsIn,
} from 'class-validator';

export class UpdateHospitalSettingsDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  hospitalName!: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  legalName?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  registrationNumber?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  taxNumber?: string;

  @IsEmail()
  @IsOptional()
  @MaxLength(100)
  email?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  alternatePhone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  website?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  defaultLocale?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  defaultTimezone?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  defaultCurrency?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  dateFormat?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  timeFormat?: string;

  @IsString()
  @IsOptional()
  receiptHeader?: string;

  @IsString()
  @IsOptional()
  receiptFooter?: string;

  @IsString()
  @IsOptional()
  invoiceFooter?: string;

  @IsString()
  @IsOptional()
  changeReason?: string;
}

export class UpdateBrandingDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  logoUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  faviconUrl?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'primaryColor must be a valid hex color code (e.g. #0284c7)',
  })
  primaryColor?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'secondaryColor must be a valid hex color code (e.g. #0f172a)',
  })
  secondaryColor?: string;

  @IsString()
  @IsOptional()
  changeReason?: string;
}

export class CreateBranchDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  @Matches(/^[A-Z0-9_-]+$/, {
    message: 'code must contain only uppercase alphanumeric characters, dashes or underscores',
  })
  code!: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;

  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

export class UpdateBranchDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  address?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  phone?: string;
}

export class SetBranchStatusDto {
  @IsBoolean()
  @IsNotEmpty()
  active!: boolean;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class UpdateBranchSettingsDto {
  @IsObject()
  @IsOptional()
  operatingHours?: Record<string, any>;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  timezoneOverride?: string;

  @IsString()
  @IsOptional()
  @MaxLength(10)
  currencyOverride?: string;

  @IsString()
  @IsOptional()
  receiptHeaderOverride?: string;

  @IsString()
  @IsOptional()
  receiptFooterOverride?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  invoicePrefix?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  mrnPrefix?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  appointmentPrefix?: string;

  @IsString()
  @IsOptional()
  @MaxLength(20)
  admissionPrefix?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  logoUrlOverride?: string;

  @IsString()
  @IsOptional()
  @Matches(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/, {
    message: 'primaryColorOverride must be a valid hex color code (e.g. #0284c7)',
  })
  primaryColorOverride?: string;

  @IsString()
  @IsOptional()
  changeReason?: string;
}

export class AssignUserBranchDto {
  @IsNotEmpty()
  userId!: string | number;

  @IsOptional()
  branchId?: string | number;

  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  accessRole?: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  notes?: string;
}

export class QueryAuditLogsDto {
  @IsString()
  @IsOptional()
  @IsIn(['HOSPITAL', 'BRANCH'])
  scope?: string;

  @IsOptional()
  branchId?: string | number;

  @IsString()
  @IsOptional()
  settingKey?: string;

  @IsOptional()
  limit?: string | number;

  @IsOptional()
  offset?: string | number;
}
