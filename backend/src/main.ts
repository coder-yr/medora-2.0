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
  const corsOrigin = configService.get<string>('api.corsOrigin') || process.env.CORS_ORIGIN || '*';
  const isProd = configService.get<string>('environment') === 'production';

  // Security Headers: Helmet (Permit inline styling for Swagger docs and Status landing page)
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // Global versioned route prefix: e.g. /api/v1 (exclude root /, /status, and /api landing pages)
  const globalPrefix = `${apiPrefix}/${apiVersion}`;
  app.setGlobalPrefix(globalPrefix, {
    exclude: ['/', 'status', 'api'],
  });

  // Global strict request validation
  app.useGlobalPipes(createValidationPipe());

  // CORS security configuration - enforce non-wildcard in production
  if (isProd && (corsOrigin === '*' || corsOrigin.includes('*'))) {
    throw new Error(
      '[Security] Wildcard CORS origin (*) is strictly forbidden in production environments',
    );
  }

  const allowedOriginsList = corsOrigin.includes(',')
    ? corsOrigin.split(',').map((origin) => origin.trim())
    : [corsOrigin.trim()];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (like curl, mobile apps, or server-to-server)
      if (!origin) return callback(null, true);

      const isAllowed =
        allowedOriginsList.includes(origin) ||
        allowedOriginsList.includes('*') ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost:') ||
        origin.startsWith('http://127.0.0.1:') ||
        /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin);

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error(`[CORS] Origin "${origin}" is not authorized`), false);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-correlation-id',
      'x-request-id',
      'x-branch-id',
      'x-organization-id',
      'X-Branch-Id',
      'X-Organization-Id',
      'Accept',
      'Origin',
      'X-Requested-With',
      'Range',
    ],
    exposedHeaders: ['x-correlation-id', 'x-request-id'],
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
    logger.log(`Swagger OpenAPI documentation: /api/docs (port ${port})`);
  } else {
    logger.log('Swagger documentation is disabled in production mode');
  }

  // Enable graceful process termination
  app.enableShutdownHooks();

  await app.listen(port, '0.0.0.0');
  logger.log(`Medora 2.0 backend listening on port ${port}`);
  logger.log(`API base endpoint: /${globalPrefix}`);
  logger.log(`Swagger documentation: /api/docs`);
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup failure:', err);
  process.exit(1);
});
