import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { FaceIdModule } from "../face-id/face-id.module";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";

@Module({
  imports: [JwtModule.register({}), FaceIdModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
