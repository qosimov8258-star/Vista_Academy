import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { FileInterceptor } from "@nestjs/platform-express";
import { diskStorage } from "multer";
import { randomUUID } from "crypto";
import { extname } from "path";
import { mkdirSync } from "fs";
import type { Request, Response } from "express";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { AVATAR_UPLOAD_DIR } from "../../common/constants/uploads";
import { AuthService, IssuedTokens } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { UpdateProfileDto } from "./dto/update-profile.dto";
import { AuthenticatedUser } from "./auth.types";

const AVATAR_MIME_PATTERN = /^image\/(jpeg|png|webp|gif)$/;
const AVATAR_MAX_SIZE = 5 * 1024 * 1024;

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

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Patch("me")
  async updateMe(@CurrentUser() user: AuthenticatedUser, @Body() dto: UpdateProfileDto) {
    const updated = await this.authService.updateProfile(user.id, dto);
    return { user: updated };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post("me/avatar")
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          mkdirSync(AVATAR_UPLOAD_DIR, { recursive: true });
          cb(null, AVATAR_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          cb(null, `${randomUUID()}${extname(file.originalname) || ".jpg"}`);
        },
      }),
      limits: { fileSize: AVATAR_MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!AVATAR_MIME_PATTERN.test(file.mimetype)) {
          cb(new BadRequestException("Faqat rasm fayllari qabul qilinadi (jpeg, png, webp, gif)"), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadAvatar(@CurrentUser() user: AuthenticatedUser, @UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException("Fayl yuborilmadi");
    }
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    const updated = await this.authService.updateAvatar(user.id, avatarUrl);
    return { user: updated };
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
