import { PlatformUser, PlatformUserRole } from "@prisma/client";

export interface AuthenticatedUser {
  id: string;
  login: string;
  fullName: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: PlatformUserRole;
}

export interface AccessTokenPayload {
  sub: string;
  login: string;
  role: PlatformUserRole;
}

export function toAuthenticatedUser(user: PlatformUser): AuthenticatedUser {
  return {
    id: user.id,
    login: user.login,
    fullName: user.fullName,
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    role: user.role,
  };
}
