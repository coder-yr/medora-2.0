import { Module } from '@nestjs/common';
import { DepartmentModule } from '../department/department.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';

@Module({
  imports: [PrismaModule, DepartmentModule],
  controllers: [DoctorController],
  providers: [DoctorService],
  exports: [DoctorService],
})
export class DoctorModule {}
