import { Injectable } from '@nestjs/common';
import { PrismaService, DatabaseHealthReport } from '../prisma/prisma.service';

export interface LivenessReport {
  status: 'ok';
  service: string;
  version: string;
  timestamp: string;
  uptimeSeconds: number;
  memoryUsage: {
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
  };
}

export interface ReadinessReport {
  status: 'ready' | 'not_ready';
  service: string;
  version: string;
  timestamp: string;
  checks: {
    database: DatabaseHealthReport;
  };
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

  getLiveness(): LivenessReport {
    const memory = process.memoryUsage();
    return {
      status: 'ok',
      service: 'medora-backend',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      memoryUsage: {
        heapUsedMb: Math.round((memory.heapUsed / 1024 / 1024) * 100) / 100,
        heapTotalMb: Math.round((memory.heapTotal / 1024 / 1024) * 100) / 100,
        rssMb: Math.round((memory.rss / 1024 / 1024) * 100) / 100,
      },
    };
  }

  async getReadiness(): Promise<{ statusCode: number; report: ReadinessReport }> {
    const dbHealth = await this.prisma.checkHealth();
    const isReady = dbHealth.status === 'connected';

    const report: ReadinessReport = {
      status: isReady ? 'ready' : 'not_ready',
      service: 'medora-backend',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth,
      },
    };

    // Return 200 if connected; 503 if disconnected/unreachable
    const statusCode = isReady ? 200 : 503;
    return { statusCode, report };
  }
}
