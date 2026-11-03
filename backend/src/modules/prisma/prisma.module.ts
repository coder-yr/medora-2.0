import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { BranchAuthorizationService } from '../../common/services/branch-authorization.service';

@Global()
@Module({
  providers: [PrismaService, BranchAuthorizationService],
  exports: [PrismaService, BranchAuthorizationService],
})
export class PrismaModule {}
