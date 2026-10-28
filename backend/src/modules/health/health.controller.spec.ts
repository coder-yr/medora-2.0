import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController (Truthful Health Probes)', () => {
  let controller: HealthController;
  let service: HealthService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      checkHealth: jest.fn(),
    };
    service = new HealthService(mockPrisma);
    controller = new HealthController(service);
  });

  it('should return a healthy liveness report', () => {
    const liveness = controller.getLiveness();
    expect(liveness.status).toBe('ok');
    expect(liveness.service).toBe('medora-backend');
    expect(liveness.version).toBe('2.0.0');
    expect(typeof liveness.uptimeSeconds).toBe('number');
    expect(liveness.memoryUsage.heapUsedMb).toBeGreaterThan(0);
  });

  it('readiness check: should return 200 ready when database connectivity is verified', async () => {
    mockPrisma.checkHealth.mockResolvedValue({
      status: 'connected',
      latencyMs: 4,
      message: 'PostgreSQL connection verified via SELECT 1',
    });

    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.getReadiness(mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        checks: {
          database: expect.objectContaining({ status: 'connected' }),
        },
      }),
    );
  });

  it('readiness check: must truthfully report not_ready (503) when database is unreachable', async () => {
    mockPrisma.checkHealth.mockResolvedValue({
      status: 'disconnected',
      latencyMs: 15,
      message: 'Database unreachable: Connection refused',
    });

    const mockRes: any = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    await controller.getReadiness(mockRes);

    expect(mockRes.status).toHaveBeenCalledWith(503);
    expect(mockRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'not_ready',
        checks: {
          database: expect.objectContaining({ status: 'disconnected' }),
        },
      }),
    );
  });
});
