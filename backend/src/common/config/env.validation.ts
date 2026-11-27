import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, MinLength, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsEnum(Environment)
  @IsOptional()
  NODE_ENV: Environment = Environment.Development;

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  API_PREFIX: string = 'api';

  @IsString()
  @IsOptional()
  API_VERSION: string = 'v1';

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = '*';

  @IsString()
  DATABASE_URL!: string;

  @IsString()
  DIRECT_URL!: string;

  @IsString()
  @MinLength(16, {
    message: 'JWT_SECRET must be at least 16 characters in development and 32+ in production',
  })
  JWT_SECRET!: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '1d';

  @IsString()
  @IsOptional()
  SUPABASE_URL?: string;

  @IsString()
  @IsOptional()
  SUPABASE_ANON_KEY?: string;

  @IsString()
  @IsOptional()
  SUPABASE_SERVICE_ROLE_KEY?: string;

  @IsString()
  @IsOptional()
  SUPABASE_JWT_SECRET?: string;

  @IsString()
  @IsOptional()
  NOTIFICATION_PROVIDER_MODE?: string;

  @IsString()
  @IsOptional()
  CRON_SECRET?: string;

  @IsString()
  @IsOptional()
  RESEND_API_KEY?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsString()
  @IsOptional()
  SMTP_PORT?: string;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASS?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;

  @IsString()
  @IsOptional()
  TWILIO_ACCOUNT_SID?: string;

  @IsString()
  @IsOptional()
  TWILIO_AUTH_TOKEN?: string;

  @IsString()
  @IsOptional()
  TWILIO_FROM_NUMBER?: string;
}

/**
 * Validates environment variables at application bootstrap without logging sensitive secret values.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    const errorDetails = errors.map((err) => {
      const constraints = err.constraints ? Object.values(err.constraints) : ['Validation failed'];
      // Redact any potentially sensitive variable names or values
      return `Property "${err.property}": ${constraints.join(', ')}`;
    });

    throw new Error(
      `[ConfigValidation] Environment configuration error:\n  - ${errorDetails.join('\n  - ')}`,
    );
  }

  if (validatedConfig.NODE_ENV === Environment.Production) {
    if (validatedConfig.JWT_SECRET.length < 32) {
      throw new Error(
        '[ConfigValidation] JWT_SECRET must be at least 32 characters in production.',
      );
    }
    if (validatedConfig.NOTIFICATION_PROVIDER_MODE?.toLowerCase() === 'mock') {
      throw new Error(
        '[ConfigValidation] Mock notification providers (NOTIFICATION_PROVIDER_MODE=mock) cannot be enabled in production.',
      );
    }
  }

  return validatedConfig;
}
