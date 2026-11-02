import { Module } from "@nestjs/common";
import { PushModule } from "../push/push.module";
import { GroupMaterialsController, ParentGroupMaterialsController } from "./group-materials.controller";
import { GroupMaterialsService } from "./group-materials.service";

@Module({
  imports: [PushModule],
  controllers: [GroupMaterialsController, ParentGroupMaterialsController],
  providers: [GroupMaterialsService],
})
export class GroupMaterialsModule {}
