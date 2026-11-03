import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { createValidationPipe } from './common/pipes/validation.pipe';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') || 3000;
  const apiPrefix = configService.get<string>('api.prefix') || 'api';
  const apiVersion = configService.get<string>('api.version') || 'v1';
  const corsOrigin = configService.get<string>('api.corsOrigin') || 'http://localhost:5173';
  const isProd = configService.get<string>('environment') === 'production';

  // Security Headers: Helmet
  app.use(helmet());

  // Global versioned route prefix: e.g. /api/v1
  const globalPrefix = `${apiPrefix}/${apiVersion}`;
  app.setGlobalPrefix(globalPrefix);

  // Global strict request validation
  app.useGlobalPipes(createValidationPipe());

  // CORS security configuration - enforce non-wildcard in production
  if (isProd && (corsOrigin === '*' || corsOrigin.includes('*'))) {
    throw new Error(
      '[Security] Wildcard CORS origin (*) is strictly forbidden in production environments',
    );
  }

  const allowedOrigins = corsOrigin.includes(',')
    ? corsOrigin.split(',').map((origin) => origin.trim())
    : corsOrigin;

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-request-id'],
    exposedHeaders: ['x-correlation-id'],
  });

  // OpenAPI (Swagger) Documentation - Enabled in development/staging, disabled in production by default
  const enableSwagger = !isProd || configService.get<boolean>('api.enableSwagger') === true;
  if (enableSwagger) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Medora 2.0 Hospital Management API')
      .setDescription(
        'Trusted Clinical & Administrative REST API for Medora 2.0 (NestJS + Supabase PostgreSQL + Prisma)',
      )
      .setVersion('2.0.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Provide JWT access token obtained via /api/v1/auth/login',
        },
        'bearer',
      )
      .addTag('Health & Monitoring', 'Liveness and readiness probes')
      .addTag('Authentication & Identity', 'Staff authentication and authorization credentials')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
    logger.log(`Swagger OpenAPI documentation: http://localhost:${port}/api/docs`);
  } else {
    logger.log('Swagger documentation is disabled in production mode');
  }

  // Enable graceful process termination
  app.enableShutdownHooks();

  await app.listen(port);
  logger.log(`Medora 2.0 backend running on port ${port}`);
  logger.log(`API base endpoint: http://localhost:${port}/${globalPrefix}`);
  logger.log(`Swagger OpenAPI documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup failure:', err);
  process.exit(1);
});
