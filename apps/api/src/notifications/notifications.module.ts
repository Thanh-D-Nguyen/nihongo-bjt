import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { PushController } from "./push.controller.js";
import { PushNotificationCron } from "./push-notification.cron.js";
import { PushNotificationService } from "./push-notification.service.js";
import { SmartNotificationCron } from "./smart-notification.cron.js";
import { SmartNotificationService } from "./smart-notification.service.js";

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [PushController],
  exports: [PushNotificationService, SmartNotificationService],
  providers: [
    PushNotificationService,
    PushNotificationCron,
    SmartNotificationService,
    SmartNotificationCron,
  ],
})
export class NotificationsModule {}
