# Kundalik — tarbiyachi paneli uchun API

Tarbiyachi guruh uchun **kun tartibini** bir marta shablon qilib yozadi, har kuni mashg'ulot o'tgach uni **"o'tdi"** deb belgilaydi va kun davomida **rasm/video** yuklaydi. Guruhdagi barcha ota-onalar buni kabinetdagi **Kundalik** bo'limida vaqt chizig'i ko'rinishida ko'radi.

| Qism | Holati | Kim |
|---|---|---|
| Prisma sxemasi + migratsiya | ✅ tayyor | Usmon |
| Tarbiyachi API (`/app/diary/*`) | ✅ tayyor, 40 ta e2e sinov o'tgan | Usmon |
| Ota-ona API + kabinet sahifasi | ✅ tayyor | Usmon |
| **Tarbiyachi paneli (admin-web)** | ⏳ qilinadi | **sherik** |

> Backend'ga tegish shart emas. Bu hujjatdagi endpointlarni chaqiradigan UI kifoya. API'da o'zgarish kerak bo'lsa — avval Usmonga ayting.

---

## 1. Qanday ishlaydi

```
Shablon (bir marta)                 Har kuni
─────────────────────               ──────────────────────────────────────
08:00  Bog'chaga kelish      ──►    08:00  ✓ o'tdi
09:00  Matematika            ──►    09:00  ✓ o'tdi  "1 dan 10 gacha sanadik"  [rasm]
10:00  Gimnastika            ──►    10:00  ✓ o'tdi
12:00  Tushlik               ──►    12:00  • hozir
13:00  Kunduzgi uyqu         ──►    13:00    keyin
16:00  Suzish (Se, Pay)      ──►    (chorshanba — ko'rinmaydi)
                                    + Kun lahzalari: 6 rasm, 1 video
```

- **Shablon** guruhga tegishli. Har bandda hafta kunlari bor: masalan, suzish faqat seshanba va payshanba.
- **Belgi** (`entry`) — o'sha kuni mashg'ulot o'tdi. Vaqt va nom shablondan nusxalanadi, shuning uchun shablon keyin o'zgarsa ham o'tgan kunlar buzilmaydi.
- Shablonda yo'q voqea ham qo'shish mumkin (masalan, "Qo'g'irchoq teatri").
- **Media** (rasm/video) kunga tegishli. Xohlasa, ma'lum mashg'ulot belgisiga biriktiriladi.
- Kelajak kun uchun belgi yoki media qo'yib bo'lmaydi. O'tgan kunlarni esa to'ldirish mumkin.

## 2. Ruxsatlar

| Rol | Ko'rish | Yozish |
|---|---|---|
| TEACHER | faqat o'z guruhlari | faqat o'z guruhlari |
| BRANCH_ADMIN, MANAGER | o'z filialidagi hamma guruh | ✅ |
| FINANCE | ❌ | ❌ |
| NETWORK_ADMIN (Super Admin) | ❌ (filialga bog'lanmagan) | ❌ |

Boshqa guruhga murojaat qilinsa 403 `"Bu guruh sizga biriktirilmagan"`, mavjud bo'lmagan guruhga 404 qaytadi.

## 3. Endpointlar

Hammasi xodim tokeni bilan: `api.get/post/...` (`lib/api.ts`). Javob odatdagidek `{ success, data }` konvertida keladi — `api` uni o'zi ochadi.

### 3.1. Kun tartibi shabloni

```
GET  /app/diary/groups/:groupId/routine
PUT  /app/diary/groups/:groupId/routine
```

`PUT` **butun ro'yxatni** qabul qiladi. `id` li bandlar yangilanadi, `id` siz bandlar yaratiladi, ro'yxatda yo'qlari o'chiriladi. Tartib — massivdagi o'rni.

```jsonc
// PUT body
{
  "items": [
    { "id": "…", "startTime": "08:00", "title": "Bog'chaga kelish", "kind": "ARRIVAL",
      "weekdays": ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"] },
    { "startTime": "09:00", "endTime": "09:30", "title": "Matematika", "kind": "LESSON",
      "weekdays": ["MONDAY","WEDNESDAY","FRIDAY"] }
  ]
}
// javob: saqlangan shablon (GET bilan bir xil)
[{ "id": "…", "startTime": "08:00", "endTime": null, "title": "…", "kind": "ARRIVAL", "weekdays": [...], "sortOrder": 0 }]
```

| Maydon | Qoida |
|---|---|
| `startTime`, `endTime` | `"HH:mm"`; `endTime` ixtiyoriy va `startTime` dan keyin bo'lishi kerak |
| `title` | 1–80 belgi |
| `kind` | `ARRIVAL` `LESSON` `EXERCISE` `MEAL` `SLEEP` `WALK` `SWIM` `PLAY` `CREATIVE` `DEPARTURE` `OTHER` |
| `weekdays` | kamida bitta; `MONDAY` … `SUNDAY` |
| bandlar soni | ko'pi bilan 30 |

Shablondan band o'chirilsa, uning **o'tgan kunlardagi belgilari saqlanib qoladi**.

### 3.2. Kun

```
GET /app/diary/groups/:groupId/days/:date           → DiaryDay
GET /app/diary/groups/:groupId/days?from=&to=       → DiaryDaySummary[]  (sukut: oxirgi 14 kun, ko'pi bilan 3 oy)
```

```ts
interface DiaryDay {
  date: string;             // "2026-09-16"
  today: string;            // filial vaqti bo'yicha bugun
  weekday: string;          // "WEDNESDAY"
  group: { id: string; name: string };
  items: DiaryItem[];       // vaqt bo'yicha saralangan
  media: DiaryMedia[];      // hech bir bandga biriktirilmagan lahzalar
  summary: { total: number; done: number; photos: number; videos: number };
}

interface DiaryItem {
  key: string;              // React key uchun
  routineItemId: string | null;   // null — shablonda yo'q voqea
  entryId: string | null;         // null — hali belgilanmagan
  startTime: string; endTime: string | null;
  title: string; kind: DiaryActivityKind;
  done: boolean;
  note: string | null;
  doneAt: string | null;          // ISO
  doneByName: string | null;
  media: DiaryMedia[];            // shu belgiga biriktirilgan
}

interface DiaryMedia {
  id: string; entryId: string | null;
  kind: "PHOTO" | "VIDEO"; mimeType: string; sizeBytes: number;
  width: number | null; height: number | null; durationSeconds: number | null;
  caption: string | null; hasPoster: boolean;
  createdAt: string; createdByName: string;
}

interface DiaryDaySummary { date: string; done: number; photos: number; videos: number }  // eng yangisi birinchi
```

`items` shablon va o'sha kungi belgilarni birlashtiradi. UI'ga qo'shimcha hisob-kitob kerak emas: `done` bo'lsa belgilangan, bo'lmasa belgilash tugmasini ko'rsating.

### 3.3. Belgilash

```
POST   /app/diary/groups/:groupId/days/:date/entries
PATCH  /app/diary/entries/:id
DELETE /app/diary/entries/:id
```

```jsonc
// Shablondagi bandni belgilash — bitta bosishda:
{ "routineItemId": "…" }
// izoh bilan:
{ "routineItemId": "…", "note": "Bugun 1 dan 10 gacha sanashni o'rgandik" }

// Shablonda yo'q voqea — vaqt va nom majburiy:
{ "startTime": "11:00", "endTime": "11:40", "title": "Qo'g'irchoq teatri", "kind": "PLAY", "note": "…" }
```

- Bitta bandni ikki marta belgilash yangi yozuv yaratmaydi — o'sha kungi belgi yangilanadi. Tugma ikki marta bosilsa ham xavfsiz.
- `PATCH` qabul qiladi: `note` (null — o'chirish), `startTime`, `endTime`, `title`, `kind`.
- `DELETE` belgini bekor qiladi. Unga biriktirilgan rasm/video **o'chmaydi** — kunning umumiy lahzalariga o'tadi.
- `note` — 500 belgigacha.

### 3.4. Rasm va video

```
POST   /app/diary/groups/:groupId/days/:date/media     multipart/form-data
PATCH  /app/diary/media/:id                            { caption?, entryId? }   (entryId: null — ajratish)
DELETE /app/diary/media/:id
GET    /app/diary/media/:id/file                       fayl (video Range bilan)
GET    /app/diary/media/:id/poster                     video muqovasi
```

**Multipart maydonlari:**

| Maydon | Majburiy | Izoh |
|---|---|---|
| `file` | ✅ | rasm: `image/jpeg` `image/png` `image/webp`, ≤ **3 MB**; video: `video/mp4` `video/webm` `video/quicktime`, ≤ **8 MB** |
| `poster` | video uchun tavsiya | muqova kadri, rasm ≤ 500 KB |
| `caption` | — | 280 belgigacha |
| `entryId` | — | shu kungi belgi id si |
| `width`, `height` | — | piksel |
| `durationSeconds` | — | video davomiyligi |

**Kunlik chegara (guruhga):** 10 ta rasm va 2 ta video. Undan oshsa 400 qaytadi, xabari tayyor o'zbekcha matn — foydalanuvchiga to'g'ridan-to'g'ri ko'rsating.

> ⚠️ `lib/api.ts` `Content-Type: application/json` qo'yadi. FormData uchun `fetch` ni to'g'ridan-to'g'ri ishlating yoki `api` ga FormData qo'llovini qo'shing (sarlavhani **qo'ymaslik** kerak — brauzer `boundary` ni o'zi qo'yadi).

```ts
const form = new FormData();
form.append("file", compressedFile);
if (poster) form.append("poster", poster, "poster.jpg");
form.append("caption", caption);
form.append("durationSeconds", String(Math.round(video.duration)));

const token = getTenantAccessToken();   // lib/tenant-session
const res = await fetch(`${API_URL}/app/diary/groups/${groupId}/days/${date}/media`, {
  method: "POST",
  credentials: "include",
  headers: token ? { Authorization: `Bearer ${token}` } : {},   // Content-Type QO'YILMAYDI
  body: form,
});
```

Hozir media **bazada saqlanadi**, shuning uchun yuborishdan oldin brauzerda kichraytirish shart:

- **Rasm:** `canvas` orqali uzun tomoni ≤ 1600 px, `toBlob("image/jpeg", 0.82)`. Telefon rasmi 4–6 MB dan ~300 KB ga tushadi. HEIC (iPhone) brauzer `<input accept="image/*">` orqali odatda JPEG bo'lib keladi.
- **Video:** serverda qayta siqilmaydi. UI'da `file.size > 8 MB` bo'lsa, yuklamasdan oldin ogohlantiring: "15–20 soniyali video tanlang". Davomiylikni `<video>` ning `loadedmetadata` hodisasidan oling.
- **Video muqovasi:** `<video>` ni `currentTime = 0.5` ga surib, kadrni `canvas` ga chizing va 480 px JPEG sifatida `poster` qilib yuboring. Muqova bo'lmasa, ota-onada kulrang katak chiqadi.

**Faylni ko'rsatish.** Xodim tokeni `bogcha_tenant_at` cookie'sida ham yuradi, shuning uchun `<img src={`${API_URL}/app/diary/media/${id}/file`}>` va `<video src=… poster=…/poster>` to'g'ridan-to'g'ri ishlaydi. Video `Range` bilan uzatiladi, iPhone'da ham o'ynaydi. Faqat uzoq ochiq turgan sahifada access cookie muddati tugasa, rasm 401 qaytaradi. Shunda `onError` da sahifa ma'lumotini qayta so'rang: `api` tokenni yangilaydi, cookie ham yangilanadi.

## 4. Xatolar

| Holat | Kod | Xabar (namuna) |
|---|---|---|
| Validatsiya (vaqt, kun, uzunlik) | 400 | `"Vaqt HH:mm formatida bo'lishi kerak"` |
| Kelajak kun | 400 | `"Hali kelmagan kun uchun belgi qo'yib bo'lmaydi"` |
| Tugash < boshlanish | 400 | `"Tugash vaqti boshlanish vaqtidan keyin bo'lishi kerak"` |
| Noto'g'ri fayl turi / hajmi | 400 / 413 | `"Rasm 3 MB dan oshmasligi kerak"`, `"Fayl juda katta: rasm 3 MB, video 8 MB gacha…"` |
| Kunlik chegara | 400 | `"Bir kunda 10 tagacha rasm yuklash mumkin"` |
| Boshqa guruh | 403 | `"Bu guruh sizga biriktirilmagan"` |
| Topilmadi | 404 | `"Guruh topilmadi"`, `"Belgi topilmadi"`, `"Fayl topilmadi"` |

## 5. Tarbiyachi paneli — UI tavsiyasi

Tarbiyachi buni telefonda, bolalar orasida, bir qo'li bilan ishlatadi. **Har bir amal bitta bosish bo'lsin.**

1. **"Kundalik" sahifasi** (menyuda "Mening guruhlarim" ichida). Tepada guruh tanlagich (bir nechta guruh bo'lsa) va sana (sukut — bugun).
2. **Bugungi ro'yxat** — `GET …/days/:date`. Har bir band qatorida katta **"O'tdi ✓"** tugmasi bo'lsin. Bosilganda `POST …/entries { routineItemId }` ketadi, qator darhol yashil bo'ladi (optimistic update). Qatorni bosganda izoh va rasm qo'shish oynasi ochiladi.
3. **"+ Rasm/video"** tugmasi pastda doim ko'rinib tursin. `<input type="file" accept="image/*,video/*" capture>` telefonda kamerani darhol ochadi. Bir nechta faylni tanlash mumkin, lekin ular birma-bir yuklanadi va yuklanish holati ko'rsatiladi.
4. **"+ Voqea"** — shablonda yo'q narsa uchun: vaqt, nom va tur.
5. **Kun tartibini sozlash** (alohida sahifa yoki oyna). Bandlar ro'yxati bo'ladi: vaqt, nom, tur (ikonkali tanlagich) va hafta kunlari (7 ta kichik tugma). "Saqlash" butun ro'yxatni `PUT` qiladi. Yangi guruh uchun tayyor namuna tugmasi qulay: 08:00 kelish, 09:00 mashg'ulot, 10:00 gimnastika, 12:00 tushlik, 13:00–15:00 uyqu, 17:30 uyga ketish.
6. **Kunlar tarixi** — `GET …/days` bilan kalendar yoki tasma: qaysi kun to'ldirilgan, qaysi biri bo'sh.

Ikonka va rang mosligi ota-ona kabinetidagi bilan bir xil bo'lsa yaxshi: `apps/admin-web/src/app/(parent)/ota-ona/[slug]/(cabinet)/kundalik/kinds.tsx` (`KIND_META`). Kerak bo'lsa, uni umumiy joyga ko'chiramiz — avval kelishib olamiz.

## 6. Ota-ona tomoni (ma'lumot uchun)

```
GET /app/parent/children/:childId/diary?date=YYYY-MM-DD    → DiaryDay + { attendance }
GET /app/parent/children/:childId/diary/days?count=14      → DiaryDaySummary[]
GET /app/parent/diary/media/:id/file | /poster
```

Ota-ona bolasi qaysi guruhda bo'lsa, o'sha guruhning kundaligini ko'radi. Bugungi kun har daqiqada yangilanadi — tarbiyachi belgilagani bir daqiqa ichida ota-onaga chiqadi.

## 7. Tekshirish ro'yxati

- [ ] Shablon: qo'shish, tahrirlash, o'chirish, tartibni o'zgartirish, hafta kunlari
- [ ] Bugun: bandni belgilash, izoh qo'shish, belgini bekor qilish
- [ ] Shablonda yo'q voqea qo'shish
- [ ] Rasm: telefondagi katta rasm kichraytirilib yuklanadi (≤ 3 MB)
- [ ] Video: 8 MB dan katta bo'lsa yuklashdan oldin ogohlantiriladi; muqova yuboriladi
- [ ] Kunlik chegara xabari ko'rsatiladi
- [ ] O'qituvchi boshqa guruhni ocholmaydi
- [ ] Ota-ona kabinetida (`/ota-ona/:slug/kundalik`) hammasi ko'rinadi
- [ ] Uchala build o'tadi
