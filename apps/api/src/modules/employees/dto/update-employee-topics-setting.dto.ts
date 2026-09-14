import { ApiProperty } from "@nestjs/swagger";
import { IsBoolean } from "class-validator";

export class UpdateEmployeeTopicsSettingDto {
  @ApiProperty({ description: "Mavzularni administrator markazlashtirib boshqarsa — true" })
  @IsBoolean()
  managedByAdmin!: boolean;
}
