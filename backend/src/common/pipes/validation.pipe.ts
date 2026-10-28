import {
  BadRequestException,
  ValidationError,
  ValidationPipe as NestValidationPipe,
} from '@nestjs/common';

export const createValidationPipe = () =>
  new NestValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: (validationErrors: ValidationError[] = []) => {
      const formatErrors = (errors: ValidationError[]): string[] => {
        const messages: string[] = [];
        for (const error of errors) {
          if (error.constraints) {
            messages.push(...Object.values(error.constraints));
          }
          if (error.children && error.children.length > 0) {
            messages.push(...formatErrors(error.children));
          }
        }
        return messages;
      };

      return new BadRequestException(formatErrors(validationErrors));
    },
  });
