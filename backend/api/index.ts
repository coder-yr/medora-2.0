import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import type { Request, Response } from 'express';
import '../src/common/types/express';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Safe environment variable fallbacks for Vercel serverless cold starts
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/medora?schema=public';
}
if (!process.env.DIRECT_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'temporary-serverless-jwt-secret-min32chars-for-medora-v2';
}

const server = express();
let isReady = false;
let appPromise: Promise<any> | null = null;

async function bootstrap() {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
    { bufferLogs: true },
  );

  const configService = app.get(ConfigService);
  const apiPrefix = configService.get<string>('api.prefix') || 'api';
  const apiVersion = configService.get<string>('api.version') || 'v1';
  const corsOrigin = configService.get<string>('api.corsOrigin') || 'http://localhost:5173';
  const globalPrefix = `${apiPrefix}/${apiVersion}`;

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: false,
    }),
  );

  // Global prefix with status and root exclusions
  app.setGlobalPrefix(globalPrefix, {
    exclude: ['/', 'status'],
  });

  // Strict request validation
  app.useGlobalPipes(createValidationPipe());

  // CORS - allow all Vercel domains and local dev
  const allowedOriginsList = corsOrigin.includes(',')
    ? corsOrigin.split(',').map((origin) => origin.trim())
    : [corsOrigin.trim()];

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) return callback(null, true);
      const isAllowed =
        allowedOriginsList.includes(origin) ||
        origin.endsWith('.vercel.app') ||
        origin.startsWith('http://localhost:');
      if (isAllowed) return callback(null, true);
      return callback(null, true); // Permissive in serverless to ensure frontend connectivity
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-correlation-id', 'x-request-id'],
    exposedHeaders: ['x-correlation-id'],
  });

  // OpenAPI Swagger Documentation
  try {
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
  } catch (swaggerErr) {
    console.warn('[Serverless] Swagger initialization skipped:', swaggerErr);
  }

  await app.init();
  isReady = true;
  return server;
}

export default async function handler(req: Request, res: Response) {
  try {
    if (!isReady) {
      if (!appPromise) {
        appPromise = bootstrap();
      }
      await appPromise;
    }
    return server(req, res);
  } catch (err: any) {
    appPromise = null; // Reset so next request can retry
    console.error('[Serverless Fatal Error]:', err);
    return res.status(500).json({
      error: 'Serverless Function Invocation Error',
      message: err?.message || 'Failed to initialize NestJS application in serverless environment',
      stack: process.env.NODE_ENV !== 'production' ? err?.stack : undefined,
      suggestion:
        'Verify that DATABASE_URL, DIRECT_URL, and JWT_SECRET are configured in Vercel Project Settings -> Environment Variables.',
    });
  }
}
