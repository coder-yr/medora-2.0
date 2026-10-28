import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

export type DatabaseConnectionStatus = 'connected' | 'disconnected' | 'not_configured';

export interface DatabaseHealthReport {
  status: DatabaseConnectionStatus;
  latencyMs?: number;
  message?: string;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;
  private readonly pool?: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    let adapter: PrismaPg | undefined;
    let pool: Pool | undefined;

    if (connectionString) {
      pool = new Pool({ connectionString });
      adapter = new PrismaPg(pool);
    }

    super(
      adapter
        ? {
            adapter,
            log:
              process.env.NODE_ENV === 'development'
                ? ['warn', 'error']
                : ['error'],
          }
        : {
            log:
              process.env.NODE_ENV === 'development'
                ? ['warn', 'error']
                : ['error'],
          },
    );

    this.pool = pool;
  }

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
      this.logger.debug('Skipping Prisma auto-connect in test environment');
      return;
    }

    try {
      if (process.env.DATABASE_URL) {
        await this.$connect();
        this.isConnected = true;
        this.logger.log('Prisma Client connected to database engine successfully');
      } else {
        this.logger.warn('DATABASE_URL is not set; Prisma is in offline/unconnected mode');
      }
    } catch (error: any) {
      this.isConnected = false;
      this.logger.warn(
        `Database connection could not be established at startup: ${error?.message || error}. Application will start in standalone/offline mode.`,
      );
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.$disconnect();
      if (this.pool) {
        await this.pool.end();
      }
      this.isConnected = false;
      this.logger.log('Prisma Client disconnected');
    } catch (error: any) {
      this.logger.error(`Error disconnecting Prisma Client: ${error?.message || error}`);
    }
  }

  /**
   * Safe and truthful readiness ping for Supabase PostgreSQL.
   * Reports actual connectivity without fabricating a successful ping if no live connection was tested.
   */
  async checkHealth(): Promise<DatabaseHealthReport> {
    if (!process.env.DATABASE_URL) {
      return {
        status: 'not_configured',
        message: 'DATABASE_URL environment variable is not configured',
      };
    }

    const start = Date.now();
    try {
      // Execute a lightweight query to test real database round-trip
      await this.$queryRaw`SELECT 1`;
      this.isConnected = true;
      return {
        status: 'connected',
        latencyMs: Date.now() - start,
        message: 'PostgreSQL connection verified via SELECT 1',
      };
    } catch (error: any) {
      this.isConnected = false;
      return {
        status: 'disconnected',
        latencyMs: Date.now() - start,
        message: `Database unreachable: ${error?.message || 'Connection refused or timeout'}`,
      };
    }
  }

  get connected(): boolean {
    return this.isConnected;
  }
}
