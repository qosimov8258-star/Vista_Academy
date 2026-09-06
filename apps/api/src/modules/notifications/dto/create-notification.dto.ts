import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { NotificationEventType } from "@prisma/client";

export class CreateNotificationDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  childId?: string;

  @ApiProperty({ enum: NotificationEventType, default: "CUSTOM" })
  @IsEnum(NotificationEventType)
  eventType!: NotificationEventType;

  @ApiProperty({ example: "Karimova Aziza" })
  @IsString()
  @MinLength(2)
  recipientName!: string;

  @ApiPropertyOptional({ example: "+998901234567" })
  @IsOptional()
  @IsString()
  recipientContact?: string;

  @ApiProperty({ example: "Xurmatli ota-ona, farzandingiz bugun bog'chaga kelmadi." })
  @IsString()
  @MinLength(2)
  message!: string;
}
