import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  ValidateNested,
  IsIn,
  MaxLength,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecipientDto {
  @IsOptional()
  userId?: string | number;

  @IsOptional()
  patientId?: string | number;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  destination?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  recipientName?: string;
}

export class CreateNotificationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  eventType!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['IN_APP', 'EMAIL', 'SMS'])
  channel!: 'IN_APP' | 'EMAIL' | 'SMS';

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipientDto)
  recipients!: RecipientDto[];

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  @IsString()
  @IsOptional()
  @IsIn(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
  priority?: string;

  @IsOptional()
  branchId?: string | number;

  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  @MaxLength(150)
  deduplicationKey?: string;
}

export class UpdatePreferencesDto {
  @IsBoolean()
  @IsOptional()
  inAppEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  emailEnabled?: boolean;

  @IsBoolean()
  @IsOptional()
  smsEnabled?: boolean;

  @IsObject()
  @IsOptional()
  channelOverrides?: Record<string, any>;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  quietHoursStart?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5)
  quietHoursEnd?: string;
}

export class CreateTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  templateKey!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['IN_APP', 'EMAIL', 'SMS'])
  channel!: 'IN_APP' | 'EMAIL' | 'SMS';

  @IsString()
  @IsOptional()
  @MaxLength(10)
  locale?: string;

  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @IsNotEmpty()
  body!: string;

  @IsArray()
  @IsOptional()
  variables?: string[];

  @IsOptional()
  branchId?: string | number;
}

export class UpdateTemplateDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  subject?: string;

  @IsString()
  @IsOptional()
  body?: string;

  @IsArray()
  @IsOptional()
  variables?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class QueryNotificationsDto {
  @IsOptional()
  isRead?: string | boolean;

  @IsString()
  @IsOptional()
  @IsIn(['IN_APP', 'EMAIL', 'SMS'])
  channel?: string;

  @IsOptional()
  limit?: string | number;

  @IsOptional()
  offset?: string | number;
}

export class AdminQueryNotificationsDto {
  @IsString()
  @IsOptional()
  @IsIn(['IN_APP', 'EMAIL', 'SMS'])
  channel?: string;

  @IsString()
  @IsOptional()
  @IsIn(['PENDING', 'PROCESSING', 'DELIVERED', 'RETRYABLE', 'DEAD_LETTER', 'CANCELLED'])
  status?: string;

  @IsOptional()
  branchId?: string | number;

  @IsString()
  @IsOptional()
  eventType?: string;

  @IsOptional()
  limit?: string | number;

  @IsOptional()
  offset?: string | number;
}
