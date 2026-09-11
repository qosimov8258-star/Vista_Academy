import { JwtService } from "@nestjs/jwt";
import { requireTenantAccessSecret } from "../iam/tenant-auth.service";

const REVEAL_PURPOSE = "reveal-employee-secret";
const REVEAL_TOKEN_TTL = "90s";

interface RevealTokenPayload {
  sub: string;
  purpose: typeof REVEAL_PURPOSE;
}

/**
 * WebAuthn tasdiqlangandan keyin qisqa umrli (90s) "reveal token" beriladi —
 * shu token bilan bitta xodim parolini bir marta ochish mumkin. Shu bilan
 * parolni ochish uchun har safar qurilma tasdiqlash talab qilinadi, lekin
 * tasdiqlash va ochish so'rovi ikki alohida chaqiruvga bo'linadi.
 */
export function issueRevealToken(jwt: JwtService, tenantUserId: string): string {
  const payload: RevealTokenPayload = { sub: tenantUserId, purpose: REVEAL_PURPOSE };
  return jwt.sign(payload, { secret: requireTenantAccessSecret(), expiresIn: REVEAL_TOKEN_TTL });
}

export function verifyRevealToken(jwt: JwtService, token: string, tenantUserId: string): boolean {
  try {
    const payload = jwt.verify<RevealTokenPayload>(token, { secret: requireTenantAccessSecret() });
    return payload.purpose === REVEAL_PURPOSE && payload.sub === tenantUserId;
  } catch {
    return false;
  }
}
