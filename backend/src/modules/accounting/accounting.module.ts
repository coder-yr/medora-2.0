import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountingPostingService } from './accounting-posting.service';
import { AccountingController } from './accounting.controller';
import { AccountingService } from './accounting.service';

@Module({
  imports: [PrismaModule],
  controllers: [AccountingController],
  providers: [AccountingService, AccountingPostingService],
  exports: [AccountingService, AccountingPostingService],
})
export class AccountingModule {}
