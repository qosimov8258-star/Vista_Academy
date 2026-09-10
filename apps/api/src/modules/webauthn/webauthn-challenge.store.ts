import { Injectable } from "@nestjs/common";

type ChallengePurpose = "register" | "authenticate";

interface StoredChallenge {
  challenge: string;
  purpose: ChallengePurpose;
  expiresAt: number;
}

const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * WebAuthn challenge'lari bir martalik va qisqa umr ko'radi, shuning uchun
 * bazaga yozib o'tirish shart emas — xotirada saqlash yetarli. Bitta
 * tenantUser bir vaqtda faqat bitta ochiq challenge'ga ega bo'ladi (yangisi
 * eskisini almashtiradi).
 */
@Injectable()
export class WebAuthnChallengeStore {
  private readonly challenges = new Map<string, StoredChallenge>();

  save(tenantUserId: string, purpose: ChallengePurpose, challenge: string): void {
    this.challenges.set(tenantUserId, { challenge, purpose, expiresAt: Date.now() + CHALLENGE_TTL_MS });
  }

  /** Challenge'ni o'qib, darhol o'chiradi — qayta ishlatib bo'lmaydi. */
  consume(tenantUserId: string, purpose: ChallengePurpose): string | null {
    const stored = this.challenges.get(tenantUserId);
    this.challenges.delete(tenantUserId);
    if (!stored || stored.purpose !== purpose || stored.expiresAt < Date.now()) {
      return null;
    }
    return stored.challenge;
  }
}
