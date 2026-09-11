import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";

@Module({
  imports: [JwtModule.register({})],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
