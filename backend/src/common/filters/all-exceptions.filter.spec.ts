import { ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let mockResponse: any;
  let mockRequest: any;
  let mockHost: ArgumentsHost;

  beforeEach(() => {
    filter = new AllExceptionsFilter();

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {
      method: 'GET',
      url: '/api/v1/patients',
      correlationId: 'test-corr-id-1234',
    };

    mockHost = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('should format HttpExceptions with standardized ApiResponse structure', () => {
    const exception = new HttpException('Access Denied', HttpStatus.FORBIDDEN);

    filter.catch(exception, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.FORBIDDEN);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          statusCode: HttpStatus.FORBIDDEN,
          message: 'Access Denied',
        }),
        correlationId: 'test-corr-id-1234',
      }),
    );
  });

  it('should catch unhandled generic Errors and return 500 without leaking stack traces', () => {
    const error = new Error('Database connection crashed');

    filter.catch(error, mockHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(mockResponse.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({
          statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
        }),
        correlationId: 'test-corr-id-1234',
      }),
    );
  });
});
