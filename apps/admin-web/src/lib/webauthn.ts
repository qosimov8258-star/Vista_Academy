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
  const credentials = await api.get<{ id: string }[]>("/app/webauthn/credentials");
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

/** Joriy admin uchun yangi qurilmani (passkey) ro'yxatdan o'tkazadi — Face ID/Windows Hello/PIN so'raladi. */
async function registerDevice(): Promise<void> {
  assertSupported();
  const optionsJSON = await api.post<PublicKeyCredentialCreationOptionsJSON>("/app/webauthn/registration/options");
  const response = await startRegistration({ optionsJSON });
  await api.post("/app/webauthn/registration/verify", { response, deviceName: guessDeviceName() });
}

/** Qurilma tasdiqlanadi va parolni bir marta ochish uchun qisqa umrli token qaytadi. */
async function authenticateAndGetRevealToken(): Promise<string> {
  assertSupported();
  const optionsJSON = await api.post<PublicKeyCredentialRequestOptionsJSON>("/app/webauthn/authentication/options");
  const response = await startAuthentication({ optionsJSON });
  const { revealToken } = await api.post<{ revealToken: string }>("/app/webauthn/authentication/verify", {
    response,
  });
  return revealToken;
}

/**
 * Xodim kabineti parolini ko'rsatadi. Avval qurilmasi ro'yxatdan o'tganini
 * tekshiradi — bo'lmasa, avval ro'yxatdan o'tkazadi (bitta amal ichida),
 * so'ng WebAuthn bilan tasdiqlab, tokenni parolni olish uchun ishlatadi.
 */
export async function revealEmployeePassword(employeeId: string): Promise<{ login: string; password: string }> {
  const alreadyRegistered = await hasRegisteredDevice();
  if (!alreadyRegistered) {
    await registerDevice();
  }
  const revealToken = await authenticateAndGetRevealToken();
  return api.get<{ login: string; password: string }>(`/app/employees/${employeeId}/password`, {
    headers: { "X-Reveal-Token": revealToken },
  });
}

/**
 * Xodimni butunlay o'chiradi. Parolni ko'rsatish bilan bir xil qurilma
 * tasdiqlashi (Face ID/Windows Hello/PIN) talab qilinadi — shu tokensiz
 * o'chirish hech qachon amalga oshmaydi.
 */
export async function deleteEmployeeWithConfirmation(employeeId: string): Promise<void> {
  const alreadyRegistered = await hasRegisteredDevice();
  if (!alreadyRegistered) {
    await registerDevice();
  }
  const revealToken = await authenticateAndGetRevealToken();
  await api.delete(`/app/employees/${employeeId}`, { headers: { "X-Reveal-Token": revealToken } });
}

export function webauthnErrorMessage(err: unknown): string {
  if (err instanceof WebAuthnUnsupportedError) return err.message;
  if (err instanceof ApiError) return err.message;
  if (err instanceof DOMException && err.name === "NotAllowedError") {
    return "Tasdiqlash bekor qilindi";
  }
  return "Kutilmagan xatolik yuz berdi";
}
