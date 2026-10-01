"use client";

import { parentApi } from "./parent-api";

export type PushStatus = "unsupported" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

function isSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isSupported()) return "unsupported";
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "subscribed" : "unsubscribed";
}

/** Ruxsat so'raydi, Service Worker ro'yxatdan o'tkazadi va backend'ga obunani yuboradi. */
export async function subscribeToPush(): Promise<void> {
  if (!isSupported()) {
    throw new Error("Bu brauzer push bildirishnomani qo'llamaydi");
  }
  const { publicKey } = await parentApi.get<{ publicKey: string | null }>("/app/parent/push/public-key");
  if (!publicKey) {
    throw new Error("Push bildirishnoma hozircha sozlanmagan");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Bildirishnoma uchun ruxsat berilmadi");
  }
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    }));
  const json = sub.toJSON();
  await parentApi.post("/app/parent/push/subscribe", { endpoint: json.endpoint, keys: json.keys });
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!isSupported()) return;
  const reg = await navigator.serviceWorker.getRegistration();
  const sub = await reg?.pushManager.getSubscription();
  if (!sub) return;
  await parentApi.post("/app/parent/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe();
}
