import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { TenantAuthService, IssuedTenantTokens } from "./tenant-auth.service";
import { TenantLoginDto } from "./dto/tenant-login.dto";
import { TenantAuthenticatedUser } from "./tenant-auth.types";
import { TenantJwtAuthGuard } from "./guards/tenant-jwt-auth.guard";
import { CurrentTenantUser } from "./decorators/current-tenant-user.decorator";

const ACCESS_COOKIE = "bogcha_tenant_at";
const REFRESH_COOKIE = "bogcha_tenant_rt";

@ApiTags("Tenant Auth")
@Public()
@Controller("app/auth")
export class TenantAuthController {
  constructor(private readonly authService: TenantAuthService) {}

  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: TenantLoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateCredentials(dto.orgSlug, dto.login, dto.password);
    const tokens = await this.authService.issueTokens(user, requestMeta(req));
    setAuthCookies(res, tokens);
    return { user };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (!rawRefreshToken) {
      throw new UnauthorizedException("Refresh token topilmadi");
    }
    const tokens = await this.authService.rotateRefreshToken(rawRefreshToken, requestMeta(req));
    setAuthCookies(res, tokens);
    return { refreshed: true };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const rawRefreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    if (rawRefreshToken) {
      await this.authService.revokeRefreshToken(rawRefreshToken);
    }
    clearAuthCookies(res);
    return { loggedOut: true };
  }

  @ApiBearerAuth()
  @UseGuards(TenantJwtAuthGuard)
  @Get("me")
  async me(@CurrentTenantUser() user: TenantAuthenticatedUser) {
    return { user };
  }
}

function requestMeta(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

function setAuthCookies(res: Response, tokens: IssuedTenantTokens) {
  const secure = process.env.COOKIE_SECURE === "true";
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: tokens.accessTokenTtlMs,
    path: "/",
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: tokens.refreshTokenTtlMs,
    path: "/api/v1/app/auth",
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/app/auth" });
}
