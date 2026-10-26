import { Module } from "@nestjs/common";
import { GroupMaterialsController, ParentGroupMaterialsController } from "./group-materials.controller";
import { GroupMaterialsService } from "./group-materials.service";

@Module({
  controllers: [GroupMaterialsController, ParentGroupMaterialsController],
  providers: [GroupMaterialsService],
})
export class GroupMaterialsModule {}
