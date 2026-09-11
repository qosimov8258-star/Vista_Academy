import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { api, ApiError } from "@/lib/api";

export class WebAuthnUnsupportedError extends Error {}

function assertSupported() {
  if (!browserSupportsWebAuthn()) {
    throw new WebAuthnUnsupportedError(
      "Bu brauzer/qurilma qurilma paroli (Face ID/Windows Hello/PIN) bilan tasdiqlashni qo'llamaydi",
    );
  }
}

async function hasRegisteredDevice(): Promise<boolean> {
  const credentials = await api.get<{ id: string }[]>("/platform/webauthn/credentials");
  return credentials.length > 0;
}

function guessDeviceName(): string {
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua)) return "iPhone/iPad";
  if (/Android/.test(ua)) return "Android qurilma";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Windows/.test(ua)) return "Windows kompyuter";
  return "Qurilma";
}

/** Joriy platforma admini uchun yangi qurilmani (passkey) ro'yxatdan o'tkazadi — Face ID/Windows Hello/PIN so'raladi. */
async function registerDevice(): Promise<void> {
  assertSupported();
  const optionsJSON = await api.post<PublicKeyCredentialCreationOptionsJSON>(
    "/platform/webauthn/registration/options",
  );
  const response = await startRegistration({ optionsJSON });
  await api.post("/platform/webauthn/registration/verify", { response, deviceName: guessDeviceName() });
}

/** Qurilma tasdiqlanadi va parolni bir marta ochish uchun qisqa umrli token qaytadi. */
async function authenticateAndGetRevealToken(): Promise<string> {
  assertSupported();
  const optionsJSON = await api.post<PublicKeyCredentialRequestOptionsJSON>(
    "/platform/webauthn/authentication/options",
  );
  const response = await startAuthentication({ optionsJSON });
  const { revealToken } = await api.post<{ revealToken: string }>("/platform/webauthn/authentication/verify", {
    response,
  });
  return revealToken;
}

/**
 * Tashkilotning Super Admin kabineti (bog'cha URL'iga kirish uchun) parolini
 * ko'rsatadi. Avval qurilma ro'yxatdan o'tganini tekshiradi — bo'lmasa,
 * avval ro'yxatdan o'tkazadi, so'ng WebAuthn bilan tasdiqlab, tokenni parolni
 * olish uchun ishlatadi.
 */
export async function revealOrganizationAdminPassword(
  organizationId: string,
): Promise<{ login: string; password: string }> {
  const alreadyRegistered = await hasRegisteredDevice();
  if (!alreadyRegistered) {
    await registerDevice();
  }
  const revealToken = await authenticateAndGetRevealToken();
  return api.get<{ login: string; password: string }>(`/platform/organizations/${organizationId}/admin/password`, {
    headers: { "X-Reveal-Token": revealToken },
  });
}

export function webauthnErrorMessage(err: unknown): string {
  if (err instanceof WebAuthnUnsupportedError) return err.message;
  if (err instanceof ApiError) return err.message;
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return "Tasdiqlash bekor qilindi";
  }
  return "Kutilmagan xatolik yuz berdi";
}
