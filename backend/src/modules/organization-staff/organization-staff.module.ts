import { Module } from '@nestjs/common';
import { OrganizationStaffController } from './organization-staff.controller';
import { OrganizationStaffService } from './organization-staff.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationStaffController],
  providers: [OrganizationStaffService],
  exports: [OrganizationStaffService],
})
export class OrganizationStaffModule {}
