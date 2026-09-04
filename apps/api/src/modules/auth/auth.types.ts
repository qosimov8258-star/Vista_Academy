import { PlatformUserRole } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: PlatformUserRole;
}

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: PlatformUserRole;
}
