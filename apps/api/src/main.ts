import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import type { NextFunction, Request, Response } from "express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { UPLOADS_ROOT, UPLOAD_IMAGE_EXTENSION } from "./common/constants/uploads";
import { normalizeWebsiteHost } from "./common/website-host";
import { PrismaService } from "./database/prisma.service";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  // /uploads har bir hostda (jumladan bog'cha subdomenlarida) API bilan bir
  // origin'dan beriladi — rasm bo'lmagan fayl brauzerda sahifa bo'lib ochilib,
  // skript ishga tushirmasin: nosniff + sandbox, rasm bo'lmasa — yuklab olish.
  app.useStaticAssets(UPLOADS_ROOT, {
    prefix: "/uploads",
    setHeaders: (res, path) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Security-Policy", "sandbox");
      if (!UPLOAD_IMAGE_EXTENSION.test(path)) res.setHeader("Content-Disposition", "attachment");
    },
  });

  // Profil rasmi so'rov tanasida base64 ko'rinishida keladi. Express'ning
  // standart 100kb chegarasi 256x256 avatar uchun ham tor bo'lib qolishi
  // mumkin; server tomonda hajm ProfileService'da alohida tekshiriladi.
  app.useBodyParser("json", { limit: "1mb" });

  const corsOrigins = (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(",").map((origin) => origin.trim());

  // Har bir bog'cha platform panelida o'z mustaqil lending saytini (masalan
  // vista-academy.uz) "Veb-sayt" maydoniga kiritadi — o'sha domendan
  // brauzerda to'g'ridan-to'g'ri (cross-origin) fetch qilinganda CORS ruxsat
  // berishi kerak, aks holda "Ariza qoldirish" forma javobni o'qiy olmaydi.
  // Bu ro'yxat CORS_ORIGIN'ga qo'lda qo'shilmaydi — yangi bog'cha
  // qo'shilgach darhol ishlashi uchun DB'dan qisqa muddat (30s) keshlanib
  // tekshiriladi. Faqat OCHIQ "/app/landing" yo'llari uchun (cookie/kredensial
  // talab qilinmaydi) — pastdagi asosiy `enableCors` esa autentifikatsiyalangan
  // barcha boshqa yo'llar uchun hamon faqat qat'iy CORS_ORIGIN ro'yxatiga
  // tayanadi, xavfsizlik chegarasi o'zgarmaydi.
  const prisma = app.get(PrismaService);
  let websiteOriginCache: { hosts: Set<string>; expiresAt: number } = { hosts: new Set(), expiresAt: 0 };
  const WEBSITE_ORIGIN_CACHE_TTL_MS = 30_000;
  async function isRegisteredWebsiteOrigin(hostname: string): Promise<boolean> {
    if (Date.now() > websiteOriginCache.expiresAt) {
      const rows = await prisma.organization.findMany({
        where: { website: { not: null } },
        select: { website: true },
      });
      websiteOriginCache = {
        hosts: new Set(rows.map((row) => row.website).filter((v): v is string => !!v)),
        expiresAt: Date.now() + WEBSITE_ORIGIN_CACHE_TTL_MS,
      };
    }
    return websiteOriginCache.hosts.has(hostname);
  }

  app.use(async (req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (!origin || corsOrigins.includes(origin) || !req.path.includes("/app/landing")) {
      next();
      return;
    }
    const host = normalizeWebsiteHost(origin);
    if (!host || !(await isRegisteredWebsiteOrigin(host))) {
      next();
      return;
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    if (req.method === "OPTIONS") {
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "600");
      res.status(204).end();
      return;
    }
    next();
  });

  app.enableCors({
    // Faqat ro'yxatdagi manzillar. Bog'cha subdomenlari API'ni o'z hostidan
    // (/api/v1) chaqiradi — CORS kerak emas. Ularga ruxsat berilsa, bitta
    // subdomendagi skript boshqa bog'cha sessiyasini cookie bilan o'qiy olardi.
    origin: (origin, callback) => callback(null, !origin || corsOrigins.includes(origin)),
    credentials: true,
  });

  app.use(cookieParser());
  app.setGlobalPrefix("api/v1");

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Bog'chalar tarmog'i SaaS ERP — Platform API")
    .setDescription("Platform Super Admin panel API (organizations, plans, subscriptions, wallets)")
    .setVersion("0.1")
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  const port = process.env.PORT ? Number(process.env.PORT) : 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Platform API listening on http://localhost:${port}/api/v1`);
}

bootstrap();
