import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";

export class LessonTopicQueryDto {
  @ApiProperty()
  @IsString()
  groupId!: string;
}
