import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiConsumes, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { memoryStorage } from "multer";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { CurrentParent } from "../parent/decorators/current-parent.decorator";
import { ParentJwtAuthGuard } from "../parent/guards/parent-jwt-auth.guard";
import { AuthenticatedParent } from "../parent/parent-auth.types";
import { UploadMaterialDto } from "./dto/upload-material.dto";
import { MATERIAL_LIMITS } from "./group-materials.constants";
import { GroupMaterialsService } from "./group-materials.service";

/** Tarbiyachi/o'qituvchi paneli: guruhga fayl yuklash. */
@ApiBearerAuth()
@ApiTags("Tenant Group Materials")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/group-materials")
export class GroupMaterialsController {
  constructor(private readonly service: GroupMaterialsService) {}

  @Get("groups/:groupId")
  list(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("groupId", ParseUUIDPipe) groupId: string) {
    return this.service.list(toTenantScope(user), groupId);
  }

  @Post("groups/:groupId")
  @ApiConsumes("multipart/form-data")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
      limits: { fileSize: MATERIAL_LIMITS.maxBytes, files: 1, fields: 5 },
    }),
  )
  upload(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("groupId", ParseUUIDPipe) groupId: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadMaterialDto,
  ) {
    return this.service.upload(toTenantScope(user), { id: user.id, fullName: user.fullName }, groupId, file, dto);
  }

  @Delete(":id")
  remove(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(toTenantScope(user), id);
  }

  @Get(":id/file")
  file(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.service.sendForStaff(toTenantScope(user), id, res);
  }
}

/** Ota-ona kabineti: o'z bolasining guruhidagi fayllar (faqat o'qish). */
@ApiTags("Parent Group Materials")
@Public()
@UseGuards(ParentJwtAuthGuard)
@Controller("app/parent")
export class ParentGroupMaterialsController {
  constructor(private readonly service: GroupMaterialsService) {}

  @Get("children/:childId/materials")
  list(@CurrentParent() parent: AuthenticatedParent, @Param("childId") childId: string) {
    return this.service.listForChild(parent, childId);
  }

  @Get("materials/:id/file")
  file(@CurrentParent() parent: AuthenticatedParent, @Param("id", ParseUUIDPipe) id: string, @Res() res: Response) {
    return this.service.sendForParent(parent, id, res);
  }
}
