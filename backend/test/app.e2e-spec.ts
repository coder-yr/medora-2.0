import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request = require('supertest');
import { AppModule } from '../src/app.module';
import { createValidationPipe } from '../src/common/pipes/validation.pipe';

describe('Medora 2.0 Backend (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/medora_test';
    process.env.DIRECT_URL =
      process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/medora_test';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'local-test-jwt-secret-minimum-32-characters-required';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(createValidationPipe());
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /api/v1/health (Liveness Probe)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.body.success).toBe(true);
        expect(res.body.data.status).toBe('ok');
        expect(res.body.data.service).toBe('medora-backend');
        expect(res.body.correlationId).toBeDefined();
      });
  });

  it('GET /api/v1/health/ready (Readiness Probe)', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health/ready');
    // In offline test mode without live PostgreSQL, reports not_ready truthfully
    expect([200, 503]).toContain(res.status);
    expect(res.body.checks).toBeDefined();
    expect(res.body.checks.database).toBeDefined();
    expect(['connected', 'disconnected', 'not_configured']).toContain(
      res.body.checks.database.status,
    );
  });

  it('GET /api/v1/auth/me without token -> 401 Unauthorized', () => {
    return request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .expect(401)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.statusCode).toBe(401);
      });
  });

  it('POST /api/v1/auth/login with valid staff email -> 200 OK + JWT', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'doctor.test@medora.hospital',
        password: 'ValidPassword123!',
      })
      .expect(200);

    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.data.accessToken).toBeDefined();
    expect(loginRes.body.data.tokenType).toBe('Bearer');
    expect(loginRes.body.data.user.group).toBe('Doctor');

    const token = loginRes.body.data.accessToken;

    // Use token to query /api/v1/auth/me
    const meRes = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(meRes.body.success).toBe(true);
    expect(meRes.body.data.email).toBe('doctor.test@medora.hospital');
    expect(meRes.body.data.group).toBe('Doctor');
  });

  it('POST /api/v1/auth/login with invalid email format -> 400 Bad Request', () => {
    return request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'not-an-email',
        password: 'Password123!',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.success).toBe(false);
        expect(res.body.error.statusCode).toBe(400);
      });
  });
});
