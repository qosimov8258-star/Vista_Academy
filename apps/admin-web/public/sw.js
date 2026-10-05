// Ota-ona kabineti push bildirishnomasi. Panel yopiq bo'lsa ham shu fayl
// orqali brauzer bildirishnoma ko'rsatadi (apps/api/.../push.service.ts
// yuboradigan { title, body, url } payload'ini kutadi).

self.addEventListener("push", (event) => {
  // Sarlavha API'dan keladi; kelmasa — neytral matn (bitta bog'cha nomi
  // qattiq yozilmaydi: bu fayl hamma bog'chalar uchun bitta)
  let data = { title: "Yangi bildirishnoma", body: "" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    // Matn formatida kelsa shunchaki body qilib ko'rsatamiz
    data.body = event.data ? event.data.text() : "";
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/push-icon.png",
      // Android holat qatorida faqat shaffoflik (alfa) ko'rinadi — fonsiz "Z"
      badge: "/push-badge.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    }),
  );
});
