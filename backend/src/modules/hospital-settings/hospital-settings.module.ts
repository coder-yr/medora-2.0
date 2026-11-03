import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { HospitalSettingsController } from './hospital-settings.controller';
import { BranchController } from './branch.controller';
import { HospitalSettingsService } from './hospital-settings.service';
import { BranchAccessGuard } from '../../common/guards/branch-access.guard';

@Module({
  imports: [PrismaModule],
  controllers: [HospitalSettingsController, BranchController],
  providers: [HospitalSettingsService, BranchAccessGuard],
  exports: [HospitalSettingsService, BranchAccessGuard],
})
export class HospitalSettingsModule {}
