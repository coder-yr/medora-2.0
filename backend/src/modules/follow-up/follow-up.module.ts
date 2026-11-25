import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationModule } from '../notification/notification.module';
import { FollowUpService } from './follow-up.service';
import { FollowUpController } from './follow-up.controller';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [FollowUpController],
  providers: [FollowUpService],
  exports: [FollowUpService],
})
export class FollowUpModule {}
