import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { TenantJwtAuthGuard } from "../iam/guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "../iam/decorators/current-tenant-user.decorator";
import { TenantAuthenticatedUser, toTenantScope } from "../iam/tenant-auth.types";
import { ChildrenService } from "./children.service";
import { CreateChildDto } from "./dto/create-child.dto";
import { ChildQueryDto } from "./dto/child-query.dto";
import { UpdateChildAvatarDto } from "./dto/update-child-avatar.dto";

@ApiBearerAuth()
@ApiTags("Tenant Children")
@Public()
@UseGuards(TenantJwtAuthGuard)
@Controller("app/children")
export class ChildrenController {
  constructor(private readonly childrenService: ChildrenService) {}

  @Get()
  findAll(@CurrentTenantUser() user: TenantAuthenticatedUser, @Query() query: ChildQueryDto) {
    return this.childrenService.findAll(toTenantScope(user), query);
  }

  @Post()
  create(@CurrentTenantUser() user: TenantAuthenticatedUser, @Body() dto: CreateChildDto) {
    return this.childrenService.create(toTenantScope(user), dto);
  }

  @Get(":id")
  findOne(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.childrenService.findOne(toTenantScope(user), id);
  }

  /** Bola suratini yuklash. */
  @Put(":id/avatar")
  updateAvatar(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Body() dto: UpdateChildAvatarDto,
  ) {
    return this.childrenService.updateAvatar(toTenantScope(user), id, dto);
  }

  @Delete(":id/avatar")
  removeAvatar(@CurrentTenantUser() user: TenantAuthenticatedUser, @Param("id") id: string) {
    return this.childrenService.removeAvatar(toTenantScope(user), id);
  }

  /**
   * Suratni binar ko'rinishda qaytaradi. `<img src>` shu manzilni ishlatadi,
   * shuning uchun javob umumiy `{ success, data }` qobig'iga o'ralmaydi.
   */
  @Get(":id/avatar")
  @Header("Cache-Control", "private, max-age=60")
  async readAvatar(
    @CurrentTenantUser() user: TenantAuthenticatedUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const record = await this.childrenService.readAvatar(toTenantScope(user), id);
    if (!record.avatar) {
      throw new NotFoundException("Bolaning surati yo'q");
    }
    res.setHeader("Content-Type", record.avatarMimeType ?? "image/jpeg");
    res.send(Buffer.from(record.avatar));
  }
}
