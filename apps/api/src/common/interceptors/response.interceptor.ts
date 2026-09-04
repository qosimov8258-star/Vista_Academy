import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

interface Envelope<T> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, Envelope<T>> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<Envelope<T>> {
    return next.handle().pipe(
      map((payload) => {
        if (payload && typeof payload === "object" && "data" in (payload as object) && "meta" in (payload as object)) {
          const { data, meta } = payload as unknown as { data: T; meta: Record<string, unknown> };
          return { success: true, data, meta };
        }
        return { success: true, data: payload };
      }),
    );
  }
}
