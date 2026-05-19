import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PushController } from "./push.controller.js";
import { PushNotificationCron } from "./push-notification.cron.js";
import { PushNotificationService } from "./push-notification.service.js";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PushController],
  exports: [PushNotificationService],
  providers: [PushNotificationService, PushNotificationCron],
})
export class NotificationsModule {}
