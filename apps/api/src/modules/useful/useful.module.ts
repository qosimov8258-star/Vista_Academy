import { Module } from "@nestjs/common";
import { UsefulController } from "./useful.controller";
import { UsefulService } from "./useful.service";

@Module({
  controllers: [UsefulController],
  providers: [UsefulService],
  exports: [UsefulService],
})
export class UsefulModule {}
