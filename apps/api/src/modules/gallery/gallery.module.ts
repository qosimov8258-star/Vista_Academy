import { Module } from "@nestjs/common";
import { GalleryController, ParentGalleryController } from "./gallery.controller";
import { GalleryService } from "./gallery.service";

@Module({
  controllers: [GalleryController, ParentGalleryController],
  providers: [GalleryService],
})
export class GalleryModule {}
