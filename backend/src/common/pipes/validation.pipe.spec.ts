import { BadRequestException } from '@nestjs/common';
import { LoginDto } from '../../modules/auth/dto/login.dto';
import { createValidationPipe } from './validation.pipe';

describe('ValidationPipe (createValidationPipe)', () => {
  const pipe = createValidationPipe();

  it('should accept valid LoginDto data', async () => {
    const validData = {
      email: 'doctor@medora.hospital',
      password: 'SecurePassword123!',
    };

    const result = await pipe.transform(validData, {
      type: 'body',
      metatype: LoginDto,
    });

    expect(result).toBeDefined();
    expect(result.email).toBe('doctor@medora.hospital');
    expect(result.password).toBe('SecurePassword123!');
  });

  it('should reject invalid email format with 400 BadRequestException', async () => {
    const invalidData = {
      email: 'not-an-email',
      password: 'SecurePassword123!',
    };

    await expect(
      pipe.transform(invalidData, {
        type: 'body',
        metatype: LoginDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject passwords shorter than 8 characters', async () => {
    const invalidData = {
      email: 'doctor@medora.hospital',
      password: 'short',
    };

    await expect(
      pipe.transform(invalidData, {
        type: 'body',
        metatype: LoginDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should reject non-whitelisted unexpected properties', async () => {
    const invalidData = {
      email: 'doctor@medora.hospital',
      password: 'SecurePassword123!',
      maliciousField: 'exploit',
    };

    await expect(
      pipe.transform(invalidData, {
        type: 'body',
        metatype: LoginDto,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
