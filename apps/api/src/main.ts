import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";
import { UPLOADS_ROOT, UPLOAD_IMAGE_EXTENSION } from "./common/constants/uploads";

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
