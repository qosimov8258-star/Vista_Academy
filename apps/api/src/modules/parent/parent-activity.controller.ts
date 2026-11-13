import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator";
import { ParentJwtAuthGuard } from "./guards/parent-jwt-auth.guard";
import { CurrentParent } from "./decorators/current-parent.decorator";
import { AuthenticatedParent } from "./parent-auth.types";
import { ParentActivityService } from "./parent-activity.service";
import { PingParentPageViewDto, StartParentPageViewDto } from "./dto/parent-page-view.dto";

/**
 * Kabinet faolligi: sahifa ochilganda `views`, ekranda ochiq turganda har
 * 30 soniyada `views/:id/ping`. Panelning «Ota-onalar» bo'limi shundan
 * kim qancha kirgani va nimani ko'rganini hisoblaydi.
 */
@ApiTags("Parent Cabinet")
@Public()
@UseGuards(ParentJwtAuthGuard)
@Controller("app/parent/activity")
export class ParentActivityController {
  constructor(private readonly service: ParentActivityService) {}

  @Post("views")
  @HttpCode(HttpStatus.OK)
  start(@CurrentParent() parent: AuthenticatedParent, @Body() dto: StartParentPageViewDto) {
    return this.service.start(parent, dto.page, dto.childId);
  }

  @Post("views/:id/ping")
  @HttpCode(HttpStatus.OK)
  ping(
    @CurrentParent() parent: AuthenticatedParent,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: PingParentPageViewDto,
  ) {
    return this.service.ping(parent, id, dto.resume === true);
  }
}
