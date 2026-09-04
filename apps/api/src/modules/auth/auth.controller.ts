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
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AuthService, IssuedTokens } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { AuthenticatedUser } from "./auth.types";

const ACCESS_COOKIE = "bogcha_at";
const REFRESH_COOKIE = "bogcha_rt";

@ApiTags("Platform Auth")
@Controller("platform/auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.authService.validateCredentials(dto.email, dto.password);
    const tokens = await this.authService.issueTokens(user, requestMeta(req));
    setAuthCookies(res, tokens);
    return { user };
  }

  @Public()
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

  @Public()
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
  @UseGuards(JwtAuthGuard)
  @Get("me")
  async me(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }
}

function requestMeta(req: Request) {
  return { ip: req.ip, userAgent: req.headers["user-agent"] };
}

function setAuthCookies(res: Response, tokens: IssuedTokens) {
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
    path: "/api/v1/platform/auth",
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: "/" });
  res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/platform/auth" });
}
