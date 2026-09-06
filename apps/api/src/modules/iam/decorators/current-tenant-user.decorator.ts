import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import type { TenantAuthenticatedUser } from "../tenant-auth.types";

export const CurrentTenantUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): TenantAuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<Request & { user: TenantAuthenticatedUser }>();
    return request.user;
  },
);
