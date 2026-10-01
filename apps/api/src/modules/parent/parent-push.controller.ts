import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { PushService } from "../push/push.service";
import { SubscribePushDto } from "../push/dto/subscribe-push.dto";
import { UnsubscribePushDto } from "../push/dto/unsubscribe-push.dto";
import { ParentJwtAuthGuard } from "./guards/parent-jwt-auth.guard";
import { CurrentParent } from "./decorators/current-parent.decorator";
import { AuthenticatedParent } from "./parent-auth.types";

/**
 * Ota-ona kabineti brauzer push bildirishnomasi. To'lov eslatmasi kabi
 * voqealar ilgari faqat kabinet ichida ko'rinardi — endi shu yo'llar orqali
 * obuna bo'lgan ota-onaga brauzer/telefon orqali ham yetib boradi.
 */
@ApiTags("Parent Cabinet")
@Public()
@Controller("app/parent/push")
export class ParentPushController {
  constructor(private readonly pushService: PushService) {}

  /** Push sozlanmagan bo'lsa `publicKey: null` — frontend obuna taklif qilmaydi. */
  @Get("public-key")
  publicKey() {
    return { publicKey: this.pushService.getPublicKey() };
  }

  @Post("subscribe")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ParentJwtAuthGuard)
  subscribe(@CurrentParent() parent: AuthenticatedParent, @Body() dto: SubscribePushDto, @Req() req: Request) {
    return this.pushService.subscribe(parent.id, dto, req.headers["user-agent"]);
  }

  @Post("unsubscribe")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ParentJwtAuthGuard)
  unsubscribe(@CurrentParent() parent: AuthenticatedParent, @Body() dto: UnsubscribePushDto) {
    return this.pushService.unsubscribe(parent.id, dto.endpoint);
  }
}
