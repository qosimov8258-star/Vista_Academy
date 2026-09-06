import { ApiProperty } from "@nestjs/swagger";
import { IsEnum } from "class-validator";
import { NotificationChannel } from "@prisma/client";

export class MarkNotificationSentDto {
  @ApiProperty({ enum: NotificationChannel })
  @IsEnum(NotificationChannel)
  channel!: NotificationChannel;
}
