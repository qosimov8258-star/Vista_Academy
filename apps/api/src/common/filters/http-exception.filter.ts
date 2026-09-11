import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { Prisma } from "@prisma/client";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpException");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const prisma = !isHttpException ? translatePrismaError(exception) : null;
    const status = isHttpException
      ? exception.getStatus()
      : (prisma?.status ?? HttpStatus.INTERNAL_SERVER_ERROR);

    const body = isHttpException ? exception.getResponse() : null;
    const { code, message, details } = prisma
      ? { code: prisma.code, message: prisma.message, details: {} }
      : normalize(body, exception);

    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} -> ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({
      success: false,
      error: { code, message, details },
    });
  }
}

function normalize(
  body: string | object | null,
  exception: unknown,
): { code: string; message: string; details: unknown } {
  if (body && typeof body === "object") {
    const anyBody = body as Record<string, unknown>;
    const message = Array.isArray(anyBody.message)
      ? anyBody.message.join("; ")
      : ((anyBody.message as string) ?? "Unexpected error");
    return {
      code: (anyBody.code as string) ?? (anyBody.error as string) ?? "ERROR",
      message,
      details: Array.isArray(anyBody.message) ? { fields: anyBody.message } : {},
    };
  }
  if (typeof body === "string") {
    return { code: "ERROR", message: body, details: {} };
  }
  // Kutilmagan xatoning matni mijozga chiqmaydi: Prisma xabarlari ichida
  // fayl yo'llari va kod satrlari bo'ladi, ular tashqariga sizmasligi kerak.
  // To'liq xato serverda jurnalga yozilgan.
  void exception;
  return {
    code: "INTERNAL_ERROR",
    message: "Serverda kutilmagan xatolik yuz berdi. Birozdan so'ng qayta urinib ko'ring.",
    details: {},
  };
}

/**
 * Ba'zi Prisma xatolarining ma'nosi aniq — ularni 500 o'rniga to'g'ri
 * javob bilan qaytaramiz. Bu servislardagi mahalliy `catch` bloklarini
 * almashtirmaydi, faqat e'tibordan chetda qolganini ushlab qoladi.
 */
function translatePrismaError(
  exception: unknown,
): { status: number; code: string; message: string } | null {
  if (!(exception instanceof Prisma.PrismaClientKnownRequestError)) {
    return null;
  }
  switch (exception.code) {
    case "P2002":
      return { status: HttpStatus.CONFLICT, code: "CONFLICT", message: "Bu ma'lumot allaqachon mavjud" };
    case "P2025":
      return { status: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: "Ma'lumot topilmadi" };
    case "P2003":
      return {
        status: HttpStatus.BAD_REQUEST,
        code: "BAD_REQUEST",
        message: "Bog'liq ma'lumot topilmadi yoki band",
      };
    default:
      return null;
  }
}
