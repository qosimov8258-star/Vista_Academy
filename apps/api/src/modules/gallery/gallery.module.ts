import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { GalleryController, ParentGalleryController } from "./gallery.controller";
import { GalleryService } from "./gallery.service";

@Module({
  imports: [PushModule],
  controllers: [GalleryController, ParentGalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
