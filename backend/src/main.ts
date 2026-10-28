import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // Global versioned route prefix: e.g. /api/v1
  const globalPrefix = `${apiPrefix}/${apiVersion}`;
  app.setGlobalPrefix(globalPrefix);

  // Global strict request validation
  app.useGlobalPipes(createValidationPipe());

  // CORS security configuration
  app.enableCors({
    origin: corsOrigin.includes(',') ? corsOrigin.split(',') : corsOrigin,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-request-id'],
    exposedHeaders: ['x-correlation-id'],
  });

  // OpenAPI (Swagger) Documentation
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
