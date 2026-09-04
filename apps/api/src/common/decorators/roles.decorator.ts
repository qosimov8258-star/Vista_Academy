import { SetMetadata } from "@nestjs/common";
import { PlatformUserRole } from "@prisma/client";

export const ROLES_KEY = "roles";
export const Roles = (...roles: PlatformUserRole[]) => SetMetadata(ROLES_KEY, roles);
