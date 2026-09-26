import { Module } from "@nestjs/common";
import { FaceIdController } from "./face-id.controller";
import { FaceIdService } from "./face-id.service";

@Module({
  controllers: [FaceIdController],
  providers: [FaceIdService],
  exports: [FaceIdService],
})
export class FaceIdModule {}
