import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ResponseInterceptor } from "./common/interceptors/response.interceptor";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Profil rasmi so'rov tanasida base64 ko'rinishida keladi. Express'ning
  // standart 100kb chegarasi 256x256 avatar uchun ham tor bo'lib qolishi
  // mumkin; server tomonda hajm ProfileService'da alohida tekshiriladi.
  app.useBodyParser("json", { limit: "1mb" });

  const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";
  app.enableCors({
    origin: corsOrigin.split(",").map((origin) => origin.trim()),
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
