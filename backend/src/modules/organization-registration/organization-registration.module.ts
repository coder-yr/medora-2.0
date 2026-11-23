import { Module } from '@nestjs/common';
import { OrganizationRegistrationController } from './organization-registration.controller';
import { OrganizationRegistrationService } from './organization-registration.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OrganizationRegistrationController],
  providers: [OrganizationRegistrationService],
  exports: [OrganizationRegistrationService],
})
export class OrganizationRegistrationModule {}
