import { Module } from "@nestjs/common";
import { PushController } from "./push.controller.js";
import { PushNotificationService } from "./push-notification.service.js";

@Module({
  controllers: [PushController],
  exports: [PushNotificationService],
  providers: [PushNotificationService],
})
export class NotificationsModule {}
