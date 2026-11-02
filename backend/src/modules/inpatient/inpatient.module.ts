import { Module } from '@nestjs/common';
import { InpatientController } from './inpatient.controller';
import { InpatientService } from './inpatient.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [InpatientController],
  providers: [InpatientService],
  exports: [InpatientService],
})
export class InpatientModule {}
