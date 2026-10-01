# hik-agent — Hikvision yuz tanish terminali ⇄ Vista Academy ERP

Terminal obyektning lokal tarmog'ida (LAN) turadi, server esa unga to'g'ridan-to'g'ri chiqa olmaydi (NAT). Shu sababli obyektdagi
kompyuterda (yoki mini-PC / Raspberry Pi) shu agent ishlaydi:

```
Terminal ⇄ (LAN, ISAPI, Digest auth) ⇄ hik-agent ⇄ (HTTPS, agent tokeni) ⇄ ERP
```

Agent har `POLL_INTERVAL_SEC` soniyada:

1. **Voqealar** — terminaldan yangi kirish voqealarini (`AcsEvent`, major 5) sahifalab o'qiydi, faqat xodim aniqlangan
   (`employeeNoString` bor) voqealarni ERP'ga yuboradi. Oxirgi o'qilgan vaqt `data/state-*.json` da saqlanadi. Internet
   uzilsa voqealar `data/queue-*.json` navbatida yig'iladi va aloqa tiklangach yuboriladi (takror yuborilsa ERP ularni
   ikki marta yozmaydi).
2. **Buyruqlar** — ERP navbatidagi buyruqlarni oladi va terminalda bajaradi, natijani qaytaradi:
   - `ADD_OR_UPDATE_USER` — xodimni qo'shadi (bor bo'lsa — o'zgartiradi);
   - `SET_FACE` — xodim suratini ≤200 KB JPEG qilib yuz kutubxonasiga yuklaydi (bor bo'lsa — almashtiradi);
   - `DELETE_USER` — xodimni terminaldan o'chiradi.

Terminal ulanmasa — exponential backoff (5 s → 5 daqiqa), buyruqlar olinmaydi (ERP ularni keyin qayta beradi).
Parol va tokenlar hech qachon logga chiqmaydi.

## Talablar

- Node.js 20+ (tavsiya: 22 LTS)
- Terminal bilan bir tarmoqda, ERP'ga (HTTPS) chiqa oladigan kompyuter
- Terminalda ISAPI yoqilgan, statik IP, administrator logini

## 1. ERP'da qurilma qo'shish

Admin panel → **Face ID → Qurilmalar → + Yangi qurilma**: nomi, IP, port (odatda 80), terminal logini va paroli.
Saqlagach **agent tokeni** bir marta ko'rsatiladi — nusxalab oling (yo'qolsa: "Yangi token", eskisi bekor bo'ladi).

## 2. O'rnatish

```bash
git clone <repo> && cd <repo>/hik-agent   # yoki faqat hik-agent papkasini ko'chiring
npm ci
npm run build
```

### Ulash (bir marta) — `.env` kerak emas

1. ERP → Face ID → Qurilmalar → **"Agentni ulash"** — 8 belgili kod chiqadi (masalan `K7Q2-M9XD`, 15 daqiqa, bir marta).
2. Shu kompyuterda: `npm run pair` va kodni kiriting (yoki `npm run pair -- K7Q2-M9XD`).
3. `npm start` (yoki pm2). Agent filialdagi barcha faol qurilmalarni ERP'dan o'zi oladi; keyin ERP'da qo'shilgan
   har bir yangi qurilma bir daqiqa ichida o'zi ulanadi, o'chirilgani to'xtatiladi — tokenni hech qayerga yozish shart emas.

Kalit `data/agent.json` da saqlanadi (faqat egasi o'qiy oladi). Kompyuter yo'qolsa — ERP'da agentni **"Uzish"**.
ERP manzili sukut bo'yicha `https://platform.zeeron.uz/api/v1`; boshqasi kerak bo'lsa `.env` da `ERP_URL`.

### Eski usul (ixtiyoriy): qurilma tokeni bilan

`cp .env.example .env` va `AGENT_TOKENS=hik_...` (bir nechta terminal: `hik_aaa,hik_bbb`). Agent ulangan bo'lsa
(`data/agent.json` bor) `.env` dagi tokenlar e'tiborsiz qoldiriladi — bir qurilmaga ikki ishchi bo'lmasin.

Tekshirish (terminal nimani qo'llashini ko'rsatadi, hech narsani o'zgartirmaydi):

```bash
npm run probe
```

## 3. Doimiy ishga tushirish (pm2)

### Linux

```bash
sudo npm i -g pm2
pm2 start dist/src/index.js --name hik-agent --cwd "$(pwd)"
pm2 save
pm2 startup      # chiqqan buyruqni ishga tushiring — qayta yoqilganda o'zi ko'tariladi
pm2 logs hik-agent
```

### Windows

```powershell
npm i -g pm2 pm2-windows-startup
pm2 start dist\src\index.js --name hik-agent --cwd "C:\hik-agent"
pm2 save
pm2-startup install
pm2 logs hik-agent
```

Yangilash: `git pull && npm ci && npm run build && pm2 restart hik-agent`.

## Sozlamalar (`.env`)

| O'zgaruvchi | Sukut | Ma'nosi |
|---|---|---|
| `ERP_URL` | — | ERP API manzili (`/api/v1` bilan) |
| `AGENT_TOKENS` | — | Qurilma tokenlari, vergul bilan |
| `POLL_INTERVAL_SEC` | 5 | Tekshirish oralig'i |
| `DATA_DIR` | `./data` | Holat va navbat fayllari |
| `INITIAL_LOOKBACK_HOURS` | 24 | Birinchi ishga tushishda qancha oldingi voqealar olinadi |
| `LOG_LEVEL` | info | debug / info / warn / error |
| `FACE_JSON_FIELD` | `FaceDataRecord` | Yuz yuklash multipart JSON qismi nomi |
| `FACE_IMAGE_FIELD` | `img` | Yuz yuklash multipart rasm qismi nomi |
| `FACE_LIB_TYPE` / `FACE_FDID` | `blackFD` / `1` | Yuz kutubxonasi |
| `FACE_MAX_BYTES` | 200000 | Rasm hajmi chegarasi |
| `NAME_MAX_BYTES` | (capabilities) | Ism uzunligi; bo'sh — terminaldan o'qiladi, bo'lmasa 32 |
| `USER_VALID_END` | 2037-12-31T23:59:59 | Xodim terminalda qachongacha amal qiladi |

## ⚠️ Terminalda tasdiqlanishi kerak bo'lgan joylar

ISAPI maydonlari proshivkaga qarab farq qiladi. Quyidagilar Hikvision ISAPI hujjatiga ko'ra yozilgan va mock serverda
sinalgan, lekin **haqiqiy terminalda hali tekshirilmagan**. `npm run probe` natijasi bilan solishtiring:

1. **Yuz yuklash multipart qism nomlari** — `FaceDataRecord` (JSON) va `img` (JPEG). Ba'zi proshivkalarda boshqacha
   (masalan `FaceImage`). `/ISAPI/Intelligent/FDLib/capabilities` ga qarang; farq qilsa `.env` da `FACE_JSON_FIELD` /
   `FACE_IMAGE_FIELD` ni o'zgartiring.
2. **Yuz kutubxonasi** — `faceLibType: blackFD`, `FDID: 1`. `/ISAPI/Intelligent/FDLib?format=json` ro'yxati bilan solishtiring.
3. **"Allaqachon bor" xatolari** — agent `subStatusCode` / `errorMsg` da `AlreadyExist` so'zini ko'rsa xodimni `Modify`
   qiladi, yuzni esa `FDSearch/Delete` bilan o'chirib qayta yuklaydi. Terminal boshqa kod qaytarsa — ack xatosida
   ko'rinadi (ERP → Qurilmalar → navbat soni → buyruqlar).
4. **Xodimni o'chirish** yuz ma'lumotini ham o'chiradimi — ko'p modellarda ha; yo'q bo'lsa yuz kutubxonada qoladi.
5. **Ism uzunligi** — `UserInfo/capabilities` dagi `name.@max` dan olinadi.
6. **Voqealar vaqti** — terminal soati va vaqt zonasi (+05:00) to'g'ri sozlangan bo'lishi kerak (NTP tavsiya etiladi).

## Sinovlar

```bash
npm test     # mock ISAPI server (haqiqiy Digest auth) + mock ERP bilan
```

## Qo'lda sinov checklisti (haqiqiy terminal bilan)

1. [ ] Terminalda ISAPI yoqilgan, IP statik, agent kompyuteridan `http://<IP>` brauzerda ochiladi.
2. [ ] ERP → Face ID → Qurilmalar → yangi qurilma (IP, port, login, parol); agent ulanmagan bo'lsa "Agentni ulash" → `npm run pair`.
3. [ ] `npm run build && npm run probe` (probe hozircha `.env` dagi token bilan ishlaydi) — model, capabilities chiqadi,
       401 yo'q. Yuqoridagi "tasdiqlanishi kerak" bandlarini solishtiring.
4. [ ] `npm start` (yoki pm2). Logda "Sozlamalar olindi" chiqadi; ERP'da qurilma qatorida **Onlayn**.
5. [ ] ERP → Xodimlar → yangi xodim qo'shing. Qurilmalar sahifasida "Navbatda" 1 bo'ladi, bir necha soniyada 0 ga tushadi;
       agent logida `ADD_OR_UPDATE_USER <raqam>: qo'shildi`.
6. [ ] Terminal menyusida (yoki veb-interfeysida) → User: xodim ism va raqami (1001 kabi) bilan ko'rinadi.
7. [ ] ERP'da xodimga surat qo'ying → logda `SET_FACE ...: yuz yuklandi`; terminalda xodimning yuz rasmi paydo bo'ladi;
       ERP → Face ID → Yuz ro'yxati: holat **Ro'yxatga olindi**.
8. [ ] Xodim terminalga yuzini ko'rsatadi → eshik ochiladi / "Authenticated".
9. [ ] 5–10 soniyada logda "ERP'ga 1 ta yangi voqea yozildi"; ERP → Xodimlar davomati: xodim **Keldi**, kelgan vaqti
       to'g'ri (Toshkent vaqti). 30+ daqiqadan keyin qayta ko'rsatsa — **ketgan** vaqti yoziladi.
10. [ ] Agent kompyuterida internetni uzing, xodim yuz ko'rsatsin, internetni ulang → voqea ERP'ga keyinroq tushadi,
        takrorlanmaydi.
11. [ ] Terminal kabelini uzing → logda backoff, "Navbatda" o'sadi; ulangach buyruqlar bajariladi.
12. [ ] ERP'da xodimni o'chiring → logda `DELETE_USER ...: o'chirildi`, terminalda xodim yo'q.
13. [ ] "Sinxronlash" tugmasi → filialdagi barcha xodimlar terminalga qayta yoziladi (terminal almashtirilganda kerak).
14. [ ] Loglarda parol va `hik_...` token ko'rinmasligini tekshiring.
