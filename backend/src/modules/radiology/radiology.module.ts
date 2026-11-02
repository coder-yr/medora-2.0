import { Module } from '@nestjs/common';
import { RadiologyController } from './radiology.controller';
import { RadiologyService } from './radiology.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RadiologyController],
  providers: [RadiologyService],
  exports: [RadiologyService],
})
export class RadiologyModule {}
