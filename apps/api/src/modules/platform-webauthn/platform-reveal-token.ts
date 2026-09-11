import { JwtService } from "@nestjs/jwt";

const REVEAL_PURPOSE = "reveal-platform-secret";
const REVEAL_TOKEN_TTL = "90s";

interface RevealTokenPayload {
  sub: string;
  purpose: typeof REVEAL_PURPOSE;
}

function requirePlatformAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error("JWT_ACCESS_SECRET env var is required");
  }
  return secret;
}

/**
 * Tenant tomonidagi `reveal-token.ts` bilan bir xil g'oya, lekin platforma
 * admini (PlatformUser) uchun: WebAuthn tasdiqlangandan keyin qisqa umrli
 * (90s) token beriladi — shu token bilan tashkilot Super Admin kabineti
 * parolini bir marta ochish mumkin.
 */
export function issuePlatformRevealToken(jwt: JwtService, platformUserId: string): string {
  const payload: RevealTokenPayload = { sub: platformUserId, purpose: REVEAL_PURPOSE };
  return jwt.sign(payload, { secret: requirePlatformAccessSecret(), expiresIn: REVEAL_TOKEN_TTL });
}

export function verifyPlatformRevealToken(jwt: JwtService, token: string, platformUserId: string): boolean {
  try {
    const payload = jwt.verify<RevealTokenPayload>(token, { secret: requirePlatformAccessSecret() });
    return payload.purpose === REVEAL_PURPOSE && payload.sub === platformUserId;
  } catch {
    return false;
  }
}
