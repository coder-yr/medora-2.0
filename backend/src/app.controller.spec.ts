import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { HealthService } from './modules/health/health.service';

describe('AppController', () => {
  let controller: AppController;

  const mockHealthService = {
    getLiveness: jest.fn().mockReturnValue({
      status: 'ok',
      service: 'medora-backend',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: 120,
      memoryUsage: { heapUsedMb: 50, heapTotalMb: 100, rssMb: 120 },
    }),
    getReadiness: jest.fn().mockResolvedValue({
      statusCode: 200,
      report: {
        status: 'ready',
        service: 'medora-backend',
        version: '2.0.0',
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'connected', latencyMs: 5 },
        },
      },
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should render HTML status page by default', async () => {
    const mockReq: any = {
      headers: {},
      query: {},
      get: jest.fn().mockReturnValue('localhost:3000'),
      protocol: 'http',
    };
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await controller.getRoot(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.type).toHaveBeenCalledWith('text/html');
    expect(mockRes.send).toHaveBeenCalledWith(expect.stringContaining('Medora 2.0 Backend'));
  });

  it('should render JSON status if requested', async () => {
    const mockReq: any = {
      headers: { accept: 'application/json' },
      query: {},
      get: jest.fn().mockReturnValue('localhost:3000'),
      protocol: 'http',
    };
    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };

    await controller.getStatus(mockReq, mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'online',
        message: expect.stringContaining('Medora 2.0'),
      }),
    );
  });
});
