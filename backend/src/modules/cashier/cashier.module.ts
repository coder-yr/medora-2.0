import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CashierController } from './cashier.controller';
import { CashierService } from './cashier.service';

@Module({
  imports: [PrismaModule],
  controllers: [CashierController],
  providers: [CashierService],
  exports: [CashierService],
})
export class CashierModule {}
