import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../database/prisma.service";
import { ParentAuthService, IssuedParentTokens } from "./parent-auth.service";
import { ParentService } from "./parent.service";
import { ParentLoginDto } from "./dto/parent-login.dto";
import { ChangeParentPasswordDto } from "./dto/change-parent-password.dto";
import { ParentJwtAuthGuard } from "./guards/parent-jwt-auth.guard";
import { CurrentParent } from "./decorators/current-parent.decorator";
import { AuthenticatedParent } from "./parent-auth.types";

const ACCESS_COOKIE = "bogcha_parent_at";
const REFRESH_COOKIE = "bogcha_parent_rt";

/**
 * Ota-ona kabineti. Barcha yo'llar `ParentJwtAuthGuard` bilan himoyalangan —
 * xodim tokeni bu yerga kirmaydi, ota-ona tokeni esa xodimlar yo'llariga.
 */
@ApiTags("Parent Cabinet")
@Public()
@Controller("app/parent")
export class ParentController {
  constructor(
    private readonly authService: ParentAuthService,
    private readonly parentService: ParentService,
    private readonly prisma: PrismaService,
  ) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: ParentLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const parent = await this.authService.validateCredentials(dto.orgSlug, dto.phone, dto.password);
    const tokens = await this.authService.issueTokens(parent, requestMeta(req));
    setAuthCookies(res, tokens);
    return { parent };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!raw) {
      throw new UnauthorizedException("Refresh token topilmadi");
    }
    const tokens = await this.authService.rotateRefreshToken(raw, requestMeta(req));
    setAuthCookies(res, tokens);
    return { refreshed: true };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (raw) {
      await this.authService.revokeRefreshToken(raw);
    }
    clearAuthCookies(res);
    return { loggedOut: true };
  }

  @Get("me")
  @UseGuards(ParentJwtAuthGuard)
  async me(@CurrentParent() parent: AuthenticatedParent) {
    return { parent, children: await this.parentService.children(parent) };
  }

  @Post("password")
  @HttpCode(HttpStatus.OK)
  @UseGuards(ParentJwtAuthGuard)
  changePassword(@CurrentParent() parent: AuthenticatedParent, @Body() dto: ChangeParentPasswordDto) {
    return this.authService.changePassword(parent, dto);
  }

  @Get("children/:childId/day")
  @UseGuards(ParentJwtAuthGuard)
  day(
    @CurrentParent() parent: AuthenticatedParent,
    @Param("childId") childId: string,
    @Query("date") date?: string,
  ) {
    return this.parentService.day(parent, childId, date);
  }

  @Get("children/:childId/attendance")
  @UseGuards(ParentJwtAuthGuard)
  attendance(@CurrentParent() parent: AuthenticatedParent, @Param("childId") childId: string) {
    return this.parentService.attendanceStrip(parent, childId);
  }

  /** Bolaning surati — kabinetda ko'rsatish uchun. */
  @Get("children/:childId/avatar")
  @Header("Cache-Control", "private, max-age=60")
  @UseGuards(ParentJwtAuthGuard)
  async avatar(
    @CurrentParent() parent: AuthenticatedParent,
    @Param("childId") childId: string,
    @Res() res: Response,
  ) {
    // Avval biriktirilganini tekshiramiz — keyin blob o'qiladi
    await this.parentService.day(parent, childId);
    const record = await this.prisma.child.findUniqueOrThrow({
      where: { id: childId },
      select: { avatar: true, avatarMimeType: true },
    });
    if (!record.avatar) {
      throw new NotFoundException("Surat yo'q");
    }
    res.setHeader("Content-Type", record.avatarMimeType ?? "image/jpeg");
    res.send(Buffer.from(record.avatar));
  }
}

function requestMeta(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

function setAuthCookies(res: Response, tokens: IssuedParentTokens) {
  const secure = process.env.COOKIE_SECURE === "true";
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: tokens.accessTokenTtlMs,
    path: "/",
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: tokens.refreshTokenTtlMs,
    path: "/",
  });
}

function clearAuthCookies(res: Response) {
  const secure = process.env.COOKIE_SECURE === "true";
  const options = { httpOnly: true, sameSite: "lax" as const, secure, path: "/" };
  res.clearCookie(ACCESS_COOKIE, options);
  res.clearCookie(REFRESH_COOKIE, options);
}
