import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("HttpException");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = isHttpException ? exception.getResponse() : null;
    const { code, message, details } = normalize(body, exception);

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
  const message = exception instanceof Error ? exception.message : "Unexpected error";
  return { code: "INTERNAL_ERROR", message, details: {} };
}
