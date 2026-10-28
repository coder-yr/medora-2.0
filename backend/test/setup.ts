import 'reflect-metadata';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/medora_test?schema=public';
process.env.DIRECT_URL =
  process.env.DIRECT_URL || 'postgresql://postgres:postgres@localhost:5432/medora_test?schema=public';
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'local-test-jwt-secret-minimum-32-characters-required';
process.env.API_PREFIX = 'api';
process.env.API_VERSION = 'v1';
