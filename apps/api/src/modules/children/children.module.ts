import { Module } from "@nestjs/common";
import { FaceIdModule } from "../face-id/face-id.module";
import { ChildrenController } from "./children.controller";
import { ChildrenService } from "./children.service";

@Module({
  imports: [FaceIdModule],
  controllers: [ChildrenController],
  providers: [ChildrenService],
  exports: [ChildrenService],
})
export class ChildrenModule {}
