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

> ⚠️ `lib/api.ts` `Content-Type: application/json` qo'yadi, FormData uchun u yaramaydi. Tayyor yuklash funksiyasi (rasmni kichraytirish va video muqovasi bilan): **5.6**. Faylni `<img>`/`<video>` da ko'rsatish: **5.7**.

Media hozircha **bazada saqlanadi**, shuning uchun rasm yuborishdan oldin brauzerda albatta kichraytiriladi. Video serverda qayta siqilmaydi — 8 MB dan kattasini yuklashdan oldin rad eting.

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

## 5. Tarbiyachi paneli — nima qilish kerak

Tarbiyachi ham, fan o'qituvchisi ham tizimda bitta rol (`TEACHER`) va bitta menyu (`teacherEntries`). Filial admini va menejer ham xuddi shu sahifadan foydalanadi, faqat ular filialdagi hamma guruhni ko'radi. Cheklovni server o'zi qiladi, UI'da rol bo'yicha alohida mantiq shart emas.

> Tarbiyachi buni **telefonda**, bolalar orasida, ko'pincha bir qo'li bilan ishlatadi. Asosiy qoida: **har bir amal bitta bosish**, tugmalar katta (≥ 44px), sahifa 360px da qulay.

### 5.1. Tayyor turgan narsalar (qayta yozmang)

| Fayl | Ichida |
|---|---|
| `apps/admin-web/src/features/diary/types.ts` | `DiaryDay`, `DiaryItem`, `DiaryMedia`, `DiaryDaySummary`, `DiaryRoutineItem`, `DiaryActivityKind` |
| `apps/admin-web/src/features/diary/kinds.tsx` | `KIND_META[kind]` → `{ label, tone, Icon }` — 11 tur uchun ikonka, nom va rang (ota-ona kabinetidagi bilan bir xil); `CameraIcon`, `PlayGlyph`, `DiaryIcon` |
| `components/ui/*` | `Modal`, `ConfirmDialog`, `Button`, `Card`, `Input`, `Badge`, `states` (Loading/Empty/Error), `toast` |
| `lib/api.ts` | `api.get/post/put/patch/delete` — JSON so'rovlar |
| `lib/permissions.ts` | `canWriteTeaching(role)` — yozish tugmalarini ko'rsatish uchun |

`tone` — rang nomi (`lilac | mint | sky | sun | coral`). Panelda uni o'z `--color-*` tokenlaringizga moslang.

### 5.2. Yangi fayllar (tavsiya etilgan joylar)

```
apps/admin-web/src/
├─ app/(dashboard)/[slug]/diary/page.tsx                 ← filial admini/menejer: "Guruh kundaligi"
├─ app/(dashboard)/[slug]/my-diary/page.tsx              ← o'qituvchi: export { default } from "../diary/page"
├─ app/(dashboard)/[slug]/diary/routine/page.tsx         ← kun tartibini sozlash (yoki modal)
└─ features/diary/
   ├─ use-diary.ts          ← react-query hook'lari va mutatsiyalar
   ├─ upload.ts             ← FormData yuborish, rasmni kichraytirish, video muqovasi
   ├─ day-checklist.tsx     ← bugungi ro'yxat (asosiy ekran)
   ├─ entry-sheet.tsx       ← izoh / rasm qo'shish oynasi
   ├─ extra-event-modal.tsx ← "+ Voqea"
   ├─ media-strip.tsx       ← kunning rasm/videolari, o'chirish
   └─ routine-editor.tsx    ← shablon muharriri
```

`my-*` manzili `my-lessons` bilan bir xil sabab uchun kerak: o'qituvchi va admin URL'lari aralashib ketmasin.

**Menyu** (`components/layout/sidebar.tsx`) — ⚠️ umumiy fayl, qo'shishdan oldin jamoaga ayting:

```ts
// teacherEntries → "Mening guruhlarim"
{ href: `/${slug}/my-diary`, label: "Guruh kundaligi", icon: CalendarIcon, show: true },
// operationalEntries → "Kundalik ish"
{ href: `${base}/diary`, label: "Guruh kundaligi", icon: CalendarIcon, show: true },
```

Nomi "Kundalik hisobot" emas, **"Guruh kundaligi"** bo'lsin, chunki "Kundalik hisobot" (`/daily-reports` — bolaning kayfiyati, ovqati, uyqusi) allaqachon bor.

### 5.3. Asosiy ekran: "Guruh kundaligi"

```
┌──────────────────────────────────────────┐
│ Guruh kundaligi         [Yulduzcha ▾]    │  ← guruh tanlagich (1 ta bo'lsa yashirin)
│ ‹  Bugun, 16-sentabr  ›      ⚙ Tartib    │  ← sana: oldingi/keyingi kun; kelajak — yopiq
│ ███████████░░░░  7/10 o'tdi              │
├──────────────────────────────────────────┤
│ 08:00  ☀ Bog'chaga kelish        [✓ O'tdi]│
│ 09:00  📖 Matematika              [ O'tdi ]│  ← bosilsa: POST entries { routineItemId }
│        "Shakllarni o'rgandik"  🖼🖼        │  ← izoh va rasmlar (bo'lsa)
│ 12:00  🍲 Tushlik                 [ O'tdi ]│
├──────────────────────────────────────────┤
│ Kun lahzalari (4/10 rasm · 1/2 video)    │
│ [🖼][🖼][▶][🖼] [+]                        │
├──────────────────────────────────────────┤
│ [ + Voqea ]        [ 📷 Rasm / video ]    │  ← pastda yopishib turadi
└──────────────────────────────────────────┘
```

1. **Guruhlar:** `api.get<Group[]>("/app/groups")` — o'qituvchiga server faqat o'z guruhlarini qaytaradi. Filial admini uchun `?branchId=` (`useBranchContext(slug)` dagidek).
2. **Kun:** `GET /app/diary/groups/:groupId/days/:date`. Sukut sana — javobdagi `today`, lekin birinchi so'rov uchun brauzer sanasi yetarli. `date > today` bo'lsa "keyingi kun" tugmasi o'chiq.
3. **"O'tdi" tugmasi:**
   - `done === false` → `POST …/entries { routineItemId }`. Tugma **optimistic** holda darhol yashil bo'ladi, xato bo'lsa qaytadi va toast chiqadi.
   - `done === true` → qatorni bosish izoh/rasm oynasini ochadi. "Bekor qilish" `DELETE /app/diary/entries/:entryId` ni tasdiqlash bilan chaqiradi (`ConfirmDialog`).
4. **Qator bosilganda — `entry-sheet`:** izoh maydoni (`PATCH entries/:id { note }`, 500 belgi), "📷 Rasm qo'shish" (`entryId` bilan yuklash) va shu mashg'ulot rasmlari. Hali belgilanmagan qatorda "O'tdi deb saqlash" tugmasi bir yo'la `POST { routineItemId, note }` yuboradi.
5. **Kun lahzalari:** `day.media` va `day.items[].media` birga. Har bir katakda o'chirish (`DELETE media/:id`, tasdiq bilan) va izohni tahrirlash (`PATCH media/:id { caption }`). Hisoblagich `summary.photos/10`, `summary.videos/2` — chegaraga yetganda yuklash tugmasi o'chiq.
6. **"+ Voqea":** vaqt (boshlanish/tugash), nom, tur (`KIND_META` dan ikonkali tugmalar), izoh → `POST entries { startTime, endTime, title, kind, note }`.
7. **Bo'sh holat:** `items.length === 0` va shablon ham bo'sh bo'lsa, "Kun tartibi hali yo'q" va **"Namuna bilan boshlash"** tugmasini ko'rsating (5.5).
8. **Yangilash:** har bir mutatsiyadan keyin `queryClient.invalidateQueries({ queryKey: ["diary-day", groupId, date] })`.

### 5.4. Hook'lar (`features/diary/use-diary.ts`)

```ts
export const diaryKeys = {
  day: (groupId: string, date: string) => ["diary-day", groupId, date] as const,
  days: (groupId: string) => ["diary-days", groupId] as const,
  routine: (groupId: string) => ["diary-routine", groupId] as const,
};

export function useDiaryDay(groupId: string | null, date: string) {
  return useQuery({
    queryKey: diaryKeys.day(groupId ?? "", date),
    queryFn: () => api.get<DiaryDay>(`/app/diary/groups/${groupId}/days/${date}`),
    enabled: !!groupId,
  });
}

export function useMarkEntry(groupId: string, date: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: { routineItemId?: string; note?: string; startTime?: string; endTime?: string; title?: string; kind?: DiaryActivityKind }) =>
      api.post(`/app/diary/groups/${groupId}/days/${date}/entries`, body),
    // Tugma darhol yashil bo'lsin
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: diaryKeys.day(groupId, date) });
      const previous = qc.getQueryData<DiaryDay>(diaryKeys.day(groupId, date));
      if (previous && body.routineItemId) {
        qc.setQueryData<DiaryDay>(diaryKeys.day(groupId, date), {
          ...previous,
          items: previous.items.map((i) => (i.routineItemId === body.routineItemId ? { ...i, done: true } : i)),
        });
      }
      return { previous };
    },
    onError: (_e, _b, ctx) => ctx?.previous && qc.setQueryData(diaryKeys.day(groupId, date), ctx.previous),
    onSettled: () => qc.invalidateQueries({ queryKey: diaryKeys.day(groupId, date) }),
  });
}
```

### 5.5. Kun tartibi muharriri

- `GET …/routine` → ro'yxat. Har qatorda: vaqt (`<input type="time">` × 2, tugash ixtiyoriy), nom, tur (tanlagich `KIND_META` ikonkalari bilan), **hafta kunlari** — 7 ta kichik tugma (Du Se Cho Pay Ju Sha Yak), o'chirish.
- Yuqoriga/pastga surish yoki vaqt bo'yicha avtomatik saralash kifoya (drag-and-drop shart emas).
- **"Saqlash"** butun ro'yxatni yuboradi: `PUT …/routine { items }`. Mavjud bandlar `id` bilan ketadi.
- Band o'chirilayotganda ogohlantirish: "O'tgan kunlardagi belgilar saqlanib qoladi".
- **Namuna shablon** (bo'sh guruh uchun bitta tugma):

```ts
const WD = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"];
export const ROUTINE_TEMPLATE = [
  { startTime: "08:00", endTime: null,    title: "Bog'chaga kelish", kind: "ARRIVAL",   weekdays: WD },
  { startTime: "08:30", endTime: "09:00", title: "Nonushta",         kind: "MEAL",      weekdays: WD },
  { startTime: "09:00", endTime: "09:30", title: "Mashg'ulot",       kind: "LESSON",    weekdays: WD },
  { startTime: "10:00", endTime: "10:30", title: "Gimnastika",       kind: "EXERCISE",  weekdays: WD },
  { startTime: "10:45", endTime: "11:30", title: "Hovlida sayr",     kind: "WALK",      weekdays: WD },
  { startTime: "12:00", endTime: "12:40", title: "Tushlik",          kind: "MEAL",      weekdays: WD },
  { startTime: "13:00", endTime: "15:00", title: "Kunduzgi uyqu",    kind: "SLEEP",     weekdays: WD },
  { startTime: "16:00", endTime: "16:40", title: "O'yin",            kind: "PLAY",      weekdays: WD },
  { startTime: "17:30", endTime: null,    title: "Uyga ketish",      kind: "DEPARTURE", weekdays: WD },
];
```

### 5.6. Yuklash (`features/diary/upload.ts`)

```ts
import { getTenantAccessToken } from "@/lib/tenant-session";
import { ApiError } from "@/lib/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

/** Rasmni uzun tomoni 1600px, JPEG 0.82 — 4–6 MB telefon rasmi ~300 KB bo'ladi */
export async function compressImage(file: File): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((ok) => canvas.toBlob((b) => ok(b!), "image/jpeg", 0.82));
  return { blob, width: canvas.width, height: canvas.height };
}

/** Video: davomiylik va 0.5-soniyadagi kadr (muqova, 480px) */
export function videoInfo(file: File): Promise<{ duration: number; poster: Blob | null; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.muted = true; video.playsInline = true; video.preload = "auto"; video.src = url;
    video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Videoni o'qib bo'lmadi")); };
    video.onloadedmetadata = () => { video.currentTime = Math.min(0.5, video.duration / 2); };
    video.onseeked = () => {
      const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((poster) => {
        URL.revokeObjectURL(url);
        resolve({ duration: Math.round(video.duration), poster, width: video.videoWidth, height: video.videoHeight });
      }, "image/jpeg", 0.75);
    };
  });
}

export async function uploadDiaryMedia(groupId: string, date: string, file: File, opts: { caption?: string; entryId?: string } = {}) {
  const form = new FormData();
  if (file.type.startsWith("image/")) {
    const { blob, width, height } = await compressImage(file);
    form.append("file", blob, "rasm.jpg");
    form.append("width", String(width));
    form.append("height", String(height));
  } else {
    if (file.size > 8 * 1024 * 1024) throw new Error("Video 8 MB dan katta — 15–20 soniyali video tanlang");
    const info = await videoInfo(file);
    form.append("file", file, file.name);
    if (info.poster) form.append("poster", info.poster, "poster.jpg");
    form.append("durationSeconds", String(info.duration));
    form.append("width", String(info.width));
    form.append("height", String(info.height));
  }
  if (opts.caption) form.append("caption", opts.caption);
  if (opts.entryId) form.append("entryId", opts.entryId);

  const token = getTenantAccessToken();
  const res = await fetch(`${API_URL}/app/diary/groups/${groupId}/days/${date}/media`, {
    method: "POST",
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : {},   // Content-Type QO'YILMAYDI
    body: form,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.success) {
    throw new ApiError(res.status, body?.error?.code ?? "ERROR", body?.error?.message ?? "Yuklab bo'lmadi");
  }
  return body.data as DiaryMedia;
}
```

- `<input type="file" accept="image/*,video/*" multiple>`. Telefonda kamera va galereya tanlovi o'zi chiqadi.
- Bir nechta fayl tanlansa, ular **ketma-ket** yuklanadi (parallel emas). Har birining holati ko'rinsin: ⏳ → ✓ yoki ✗ va xabar.
- Yuklash paytida sahifadan chiqib ketmaslik uchun ogohlantirish qo'yish mumkin (`beforeunload`).
- 401 kelsa, `api.get("/app/auth/me")` kabi oddiy so'rov tokenni yangilaydi, keyin qayta urinib ko'ring.

### 5.7. Rasm/videoni ko'rsatish

```tsx
<img src={`${API_URL}/app/diary/media/${m.id}/file`} loading="lazy" />
<video src={`${API_URL}/app/diary/media/${m.id}/file`} poster={m.hasPoster ? `${API_URL}/app/diary/media/${m.id}/poster` : undefined} controls playsInline preload="metadata" />
```

Cookie (`bogcha_tenant_at`) avtomatik ketadi, sarlavha kerak emas. Kichik katakda videoning `poster` ini `<img>` bilan ko'rsating va ustiga `PlayGlyph` qo'ying.

## 6. Ota-ona tomoni (ma'lumot uchun)

```
GET /app/parent/children/:childId/diary?date=YYYY-MM-DD    → DiaryDay + { attendance }
GET /app/parent/children/:childId/diary/days?count=14      → DiaryDaySummary[]
GET /app/parent/diary/media/:id/file | /poster
```

Ota-ona bolasi qaysi guruhda bo'lsa, o'sha guruhning kundaligini ko'radi. Bugungi kun har daqiqada yangilanadi — tarbiyachi belgilagani bir daqiqa ichida ota-onaga chiqadi.

## 7. Tekshirish ro'yxati

- [ ] Menyuda "Guruh kundaligi": o'qituvchida `/my-diary`, filial admini/menejerda `/diary`
- [ ] Bir nechta guruhli o'qituvchi guruhni almashtira oladi; boshqa guruhni ocholmaydi
- [ ] Shablon: namuna bilan boshlash, qo'shish, tahrirlash, o'chirish, hafta kunlari
- [ ] Bugun: bitta bosishda "O'tdi", izoh qo'shish, belgini bekor qilish (tasdiq bilan)
- [ ] Shablonda yo'q voqea qo'shish
- [ ] O'tgan kunni to'ldirish mumkin; kelajak kun yopiq
- [ ] Rasm: telefondagi katta rasm kichraytirilib yuklanadi (≤ 3 MB)
- [ ] Video: 8 MB dan kattasi yuklashdan oldin rad etiladi; muqova va davomiylik yuboriladi
- [ ] Bir nechta fayl ketma-ket yuklanadi, har birining holati ko'rinadi
- [ ] Kunlik chegara (10 rasm, 2 video) — tugma o'chadi, server xabari ko'rsatiladi
- [ ] 360px telefon ekranida hamma tugma qulay bosiladi
- [ ] Ota-ona kabinetida (`/ota-ona/:slug/kundalik`) tarbiyachi belgilagani bir daqiqa ichida ko'rinadi
- [ ] Uchala build o'tadi

Lokal bazada "Yulduzcha (6-7 yosh)" guruhida namuna ma'lumot bor (tarbiyachi: `tarbiyachi5@usmon.uz`) — UI'ni shu bilan sinab ko'rish mumkin.
