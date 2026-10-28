import 'reflect-metadata';
import { validateEnv } from './env.validation';

describe('Environment Validation (validateEnv)', () => {
  const validBaseEnv = {
    NODE_ENV: 'test',
    PORT: '3000',
    API_PREFIX: 'api',
    API_VERSION: 'v1',
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/medora_test',
    DIRECT_URL: 'postgresql://postgres:postgres@localhost:5432/medora_test',
    JWT_SECRET: 'super-secret-development-jwt-token-key-32chars',
  };

  it('should successfully validate a well-formed environment configuration', () => {
    const validated = validateEnv(validBaseEnv);
    expect(validated.NODE_ENV).toBe('test');
    expect(validated.PORT).toBe(3000);
    expect(validated.API_PREFIX).toBe('api');
    expect(validated.DATABASE_URL).toBe(validBaseEnv.DATABASE_URL);
    expect(validated.JWT_SECRET).toBe(validBaseEnv.JWT_SECRET);
  });

  it('should throw an error if DATABASE_URL is missing', () => {
    const invalidEnv = { ...validBaseEnv };
    delete (invalidEnv as any).DATABASE_URL;

    expect(() => validateEnv(invalidEnv)).toThrow(/Property "DATABASE_URL"/);
  });

  it('should throw an error if JWT_SECRET is too short (< 16 chars)', () => {
    const invalidEnv = {
      ...validBaseEnv,
      JWT_SECRET: 'short',
    };

    expect(() => validateEnv(invalidEnv)).toThrow(/JWT_SECRET must be at least 16 characters/);
  });

  it('should safely omit secret values in validation error output', () => {
    const invalidEnv = {
      ...validBaseEnv,
      PORT: 'not-a-number',
      JWT_SECRET: 'short',
    };

    try {
      validateEnv(invalidEnv);
      fail('Expected validateEnv to throw an error');
    } catch (err: any) {
      expect(err.message).toContain('Property "PORT"');
      expect(err.message).toContain('Property "JWT_SECRET"');
      // Verify no raw passwords or connection URLs are leaked in the error message
      expect(err.message).not.toContain(validBaseEnv.DATABASE_URL);
    }
  });
});
