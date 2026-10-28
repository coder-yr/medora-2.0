import { Controller, Get, Res } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('Health & Monitoring')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Liveness probe (returns 200 if backend process is running)' })
  @ApiResponse({ status: 200, description: 'Service is alive and responsive' })
  getLiveness() {
    return this.healthService.getLiveness();
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe (evaluates actual database connectivity)' })
  @ApiResponse({ status: 200, description: 'Service is ready to accept traffic' })
  @ApiResponse({ status: 503, description: 'Database is unreachable or not ready' })
  async getReadiness(@Res() res: Response) {
    const { statusCode, report } = await this.healthService.getReadiness();
    return res.status(statusCode).json(report);
  }
}
