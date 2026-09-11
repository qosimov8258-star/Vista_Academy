import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { Request } from "express";
import { AuthenticatedParent } from "../parent-auth.types";

export const CurrentParent = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedParent => {
  const request = ctx.switchToHttp().getRequest<Request & { user: AuthenticatedParent }>();
  return request.user;
});
