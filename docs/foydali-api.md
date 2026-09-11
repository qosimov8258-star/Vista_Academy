# "Foydali" bo'limi: tarbiyachi paneli va API

Ota-ona kabinetidagi **Foydali** bo'limi (she'rlar, maqollar, ertaklar) frontendi tayyor, lekin hozircha namunaviy ma'lumot bilan ishlaydi. Bu hujjat — mazmunni **tarbiyachilar yuklaydigan** qismini qilish uchun: backend (jadval + API) va tarbiyachi paneli.

- Ota-ona frontendi kutayotgan format (shartnoma): `apps/admin-web/src/app/(parent)/ota-ona/[slug]/(cabinet)/foydali/content.ts`
- Namuna uchun o'xshash modullar:
  - `apps/api/src/modules/daily-reports/` — tarbiyachi yozadi, filial va guruh bo'yicha tekshiradi;
  - `apps/api/src/modules/parent/` — ota-ona o'qiydi, bola o'ziga tegishliligi tekshiriladi.

---

## 1. Ish tartibi

1. **Baza:** uchta jadval (`poems`, `proverbs`, `tales`) + migratsiya.
2. **Tarbiyachi API:** qo'shish, ko'rish, tahrirlash, o'chirish — `/app/useful/*`.
3. **Ota-ona API:** faqat o'qish — `/app/parent/useful/*`. Javob formati 3-bo'limdagidek bo'lishi **shart**: ota-ona sahifalari aynan shu maydonlarni kutadi.
4. **Tarbiyachi paneli** (admin-web): ro'yxat + forma.
5. **Ulash:** `content.ts` dagi hook'larni haqiqiy API'ga almashtirish (7-bo'lim).

---

## 2. Ma'lumotlar modeli (Prisma)

```prisma
enum UsefulStatus {
  DRAFT      // qoralama — ota-onaga ko'rinmaydi
  PUBLISHED  // chop etilgan
}

/// She'r. stanzas — bandlar: [["1-qator", "2-qator", ...], [...]]
model Poem {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  branchId       String       @map("branch_id")
  /// null — filialdagi barcha guruhlar uchun
  groupId        String?      @map("group_id")
  title          String
  author         String?
  ageFrom        Int          @default(3) @map("age_from")
  ageTo          Int          @default(6) @map("age_to")
  stanzas        Json
  status         UsefulStatus @default(PUBLISHED)
  createdById    String       @map("created_by_id")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")
  deletedAt      DateTime?    @map("deleted_at")

  organization Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  branch       Branch       @relation(fields: [branchId], references: [id], onDelete: Cascade)
  group        Group?       @relation(fields: [groupId], references: [id], onDelete: SetNull)
  createdBy    TenantUser   @relation(fields: [createdById], references: [id])

  @@index([branchId, status])
  @@map("poems")
}

model Proverb {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  branchId       String       @map("branch_id")
  groupId        String?      @map("group_id")
  text           String
  /// Bolaga tushuntirish uchun sodda izoh
  meaning        String
  status         UsefulStatus @default(PUBLISHED)
  createdById    String       @map("created_by_id")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")
  deletedAt      DateTime?    @map("deleted_at")
  // relation'lar Poem'dagidek
  @@index([branchId, status])
  @@map("proverbs")
}

model Tale {
  id             String       @id @default(uuid())
  organizationId String       @map("organization_id")
  branchId       String       @map("branch_id")
  groupId        String?      @map("group_id")
  title          String
  /// "O'zbek xalq ertagi", muallif ismi va h.k.
  origin         String
  minutes        Int
  /// Xatboshilar: string[]
  paragraphs     Json
  moral          String
  /// O'qib bo'lgach bolaga beriladigan savollar: string[]
  questions      Json
  /// Muqova: hozircha tayyor rasmlardan biri ("tun", "sholgom")
  cover          String       @default("tun")
  ageFrom        Int          @default(3) @map("age_from")
  ageTo          Int          @default(7) @map("age_to")
  status         UsefulStatus @default(PUBLISHED)
  createdById    String       @map("created_by_id")
  createdAt      DateTime     @default(now()) @map("created_at")
  updatedAt      DateTime     @updatedAt @map("updated_at")
  deletedAt      DateTime?    @map("deleted_at")
  // relation'lar Poem'dagidek
  @@index([branchId, status])
  @@map("tales")
}
```

`Organization`, `Branch`, `Group`, `TenantUser` modellariga teskari aloqalarni (`poems Poem[]` va h.k.) qo'shishni unutma.

> **Migratsiya — muhim.** Loyihada migratsiyalar qo'lda yoziladi: `apps/api/prisma/migrations/<vaqt>_add_useful_content/migration.sql`, keyin `npx prisma migrate deploy`. **`prisma migrate dev` ishlatma** — dev bazasi hamma worktree'lar uchun bitta, u bazani tozalab yuborishi mumkin.

---

## 3. Ota-ona API — frontend shu formatni kutadi

Himoya: `ParentJwtAuthGuard` (`/app/parent/*` dagi boshqa endpoint'lar kabi). Global interceptor javobni `{ "success": true, "data": ... }` ga o'raydi — frontend uni o'zi ochadi.

| Metod | Yo'l | Javob |
|---|---|---|
| GET | `/api/v1/app/parent/useful/poems` | `Poem[]` |
| GET | `/api/v1/app/parent/useful/poems/:id` | `Poem` |
| GET | `/api/v1/app/parent/useful/proverbs` | `Proverb[]` |
| GET | `/api/v1/app/parent/useful/tales` | `Tale[]` |
| GET | `/api/v1/app/parent/useful/tales/:id` | `Tale` |

### Javob maydonlari (nomlarini o'zgartirma)

```jsonc
// Poem
{
  "id": "b1f2…",
  "title": "Quyoshcha",
  "author": null,                       // shoir; noma'lum bo'lsa null
  "addedBy": "Dilnoza Karimova",        // createdBy.fullName
  "groupName": "Yulduzcha",             // group?.name, butun filial uchun bo'lsa null
  "ageFrom": 3,
  "ageTo": 6,
  "stanzas": [
    ["Tongda chiqdi quyoshcha,", "Nur sochadi oz-ozcha."],
    ["Men ham turdim ertalab,", "Yuzim yuvdim chayqalab."]
  ],
  "addedAt": "2026-09-08"               // YYYY-MM-DD, filial vaqt mintaqasida
}

// Proverb
{ "id": "…", "text": "Mehnatning tagi — rohat.", "meaning": "Kim harakat qilsa, keyin quvonchini ko'radi." }

// Tale
{
  "id": "…",
  "title": "Sholg'om",
  "origin": "Rus xalq ertagi",
  "minutes": 2,
  "paragraphs": ["Bir bor ekan…", "…"],
  "moral": "Birga, ahil bo'lsak — har qanday ishni uddalaymiz.",
  "questions": ["Bobo bahorda nima ekdi?", "…"],
  "addedBy": "Dilnoza Karimova",
  "cover": "tun",                       // noma'lum qiymat bo'lsa frontend "tun" rasmini chiqaradi
  "addedAt": "2026-09-06"
}
```

`addedAt` ni serverda filial vaqt mintaqasida (`branch.timezone`, sukut — `Asia/Tashkent`) formatla, masalan `Intl.DateTimeFormat("en-CA", { timeZone })`. Aks holda yarim tunga yaqin qo'shilganlar bir kun oldingi sana bilan chiqadi.

### Ota-ona nimani ko'radi

Ota-onaning bolalari `ChildGuardian` orqali topiladi (`ParentService.children()` dagidek). Ulardan bolalarning filiallari va guruhlari olinadi:

```
organizationId = parent.organizationId
AND status = 'PUBLISHED' AND deletedAt IS NULL
AND (
      (groupId IS NULL AND branchId IN <bolalar filiallari>)   -- butun filial uchun
   OR  groupId IN <bolalar guruhlari>                           -- bolaning guruhi uchun
)
ORDER BY createdAt DESC
```

- `/:id` ham xuddi shu shart bilan qidiriladi. Ko'rinmasa — **404** (403 emas: boshqa guruhning she'ri borligi ham bilinmasin).
- Ro'yxatlarga sahifalash hozircha shart emas — bog'cha mazmuni kam. Kerak bo'lsa, `?limit=` qo'shiladi.

---

## 4. Tarbiyachi API

Himoya: tarbiyachi JWT (`daily-reports` controller'idagidek), huquqlar service ichida `TenantScope` orqali tekshiriladi.

| Metod | Yo'l | Nima qiladi |
|---|---|---|
| GET | `/api/v1/app/useful/poems?groupId=&status=` | Filialdagi she'rlar ro'yxati |
| POST | `/api/v1/app/useful/poems` | Yangi she'r |
| GET | `/api/v1/app/useful/poems/:id` | Bittasi (tahrirlash formasi uchun) |
| PATCH | `/api/v1/app/useful/poems/:id` | Tahrirlash (qisman) |
| DELETE | `/api/v1/app/useful/poems/:id` | O'chirish (`deletedAt` qo'yiladi) |

`proverbs` va `tales` uchun ham xuddi shu beshta endpoint.

### So'rov tanalari

Tarbiyachi matnni oddiy `textarea`ga yozadi. Bandlar va xatboshilarni **server** ajratadi — bitta qoida, ikki joyda takrorlanmaydi.

```jsonc
// POST /app/useful/poems
{
  "title": "Quyoshcha",
  "author": null,
  "groupId": "…",                 // null — butun filial (faqat admin/menejer)
  "ageFrom": 3,
  "ageTo": 6,
  "text": "Tongda chiqdi quyoshcha,\nNur sochadi oz-ozcha.\n\nMen ham turdim ertalab,\nYuzim yuvdim chayqalab.",
  "status": "PUBLISHED"           // yoki "DRAFT"
}

// POST /app/useful/proverbs
{ "text": "Mehnatning tagi — rohat.", "meaning": "Kim harakat qilsa…", "groupId": null, "status": "PUBLISHED" }

// POST /app/useful/tales
{
  "title": "Sholg'om",
  "origin": "Rus xalq ertagi",
  "text": "1-xatboshi…\n\n2-xatboshi…",
  "moral": "Birga, ahil bo'lsak…",
  "questions": ["Bobo bahorda nima ekdi?", "Eng oxirida kim yordamga keldi?"],
  "minutes": null,                // null — server so'z soniga qarab hisoblaydi
  "cover": "tun",
  "groupId": null,
  "status": "PUBLISHED"
}
```

**Matnni ajratish:** `\r\n` → `\n`; har qator `trim()`; bir yoki bir necha bo'sh qator — yangi band (xatboshi); bo'sh bandlar tashlab yuboriladi. `minutes` berilmasa: `max(1, ceil(so'zlar / 120))` — ovoz chiqarib o'qish tezligi.

Javobda saqlangan obyekt qaytadi. Unda `stanzas` (yoki `paragraphs`), `status`, `groupId`, `createdBy: { id, fullName }`, `createdAt` va `updatedAt` bo'ladi — tarbiyachi formada natijani darhol ko'rsin.

### Tekshiruvlar (class-validator)

| Maydon | Qoida |
|---|---|
| `title` | 1–80 belgi |
| `author` | ≤ 80 belgi yoki `null` |
| `ageFrom`, `ageTo` | butun son 2–7, `ageFrom ≤ ageTo` |
| She'r `text` | 1–12 band, jami 2–60 qator, **har qator ≤ 60 belgi**, tavsiya — ≤ 45. She'r rasm qilib saqlanganda qator bo'linmaydi, uzun qator shriftni kichraytiradi. Formada ogohlantirish chiqar. |
| Maqol `text` / `meaning` | 3–160 / 3–400 belgi |
| Ertak `text` | 1–40 xatboshi, jami ≤ 8000 belgi |
| `moral` | 3–300 belgi |
| `questions` | 0–8 ta, har biri 3–150 belgi |
| `cover` | hozircha `"tun"` yoki `"sholgom"` |
| `groupId` | shu filialning guruhi bo'lishi shart |

Xatolar loyihadagi filtr orqali qaytadi: **400** — tekshiruvdan o'tmadi, **403** — ruxsat yo'q, **404** — topilmadi yoki boshqa tashkilotniki.

---

## 5. Kim nima qila oladi

| Rol | Ko'rish | Qo'shish / tahrirlash / o'chirish |
|---|---|---|
| `TEACHER` | O'z guruhlari va butun filialga tegishlilari | Faqat **o'z guruhlari** uchun (`groupId` majburiy). Tahrirlash va o'chirish faqat **o'zi qo'shganini**. |
| `MANAGER` | O'z filiali | Istalgan guruh yoki butun filial (`groupId: null`) |
| `BRANCH_ADMIN` | O'z filiali | Istalgan guruh yoki butun filial |
| `NETWORK_ADMIN` | Barcha filiallar (`?branchId=`) | Yo'q — kuzatuvchi |
| `FINANCE` | Yo'q | Yo'q |

Tayyor yordamchilar (`apps/api/src/modules/iam/`):

- `requireTeachingScope(scope)` — filialni qaytaradi va `FINANCE` ni to'xtatadi. `NETWORK_ADMIN` ning filiali yo'q, shuning uchun u yozish endpoint'larida o'zi to'xtaydi.
- `resolveTeacherGroupIds(prisma, scope)` — o'qituvchining guruhlari. O'qituvchi bo'lmasa `null`.

**Har doim** `organizationId` va `branchId` tokendan olinadi, so'rov tanasidan emas. `groupId` uchun alohida tekshir: guruh shu filialniki va (o'qituvchi uchun) unga biriktirilgan bo'lsin.

---

## 6. Tarbiyachi paneli (admin-web) — tavsiya

- **Menyu:** chap panelda "Foydali" bo'limi (TEACHER, MANAGER, BRANCH_ADMIN uchun). Ichida uchta tab: She'rlar · Maqollar · Ertaklar.
- **Ro'yxat:** sarlavha, guruh ("Barcha guruhlar" yoki guruh nomi), holat belgisi ("Qoralama" / "Chop etilgan"), sana. Har qatorda tahrirlash va o'chirish (o'chirishda tasdiq so'raladi).
- **"Yangi she'r" formasi:**
  - maydonlar: sarlavha, muallif (ixtiyoriy), guruh (o'qituvchiga faqat o'z guruhlari; admin/menejerga "Barcha guruhlar" ham), yosh (dan–gacha);
  - matn maydonida izoh: *"Bandlar orasida bitta bo'sh qator qoldiring"*;
  - yonida **jonli ko'rinish** — ota-ona qanday ko'rsa, shunday;
  - "Ota-onalarga ko'rsatish" almashtirgichi (`status`).
- **Maqol formasi:** maqol va "Ma'nosi (bolaga qanday tushuntirasiz)".
- **Ertak formasi:** sarlavha, kelib chiqishi, matn (xatboshilar bo'sh qator bilan ajratiladi), saboq, savollar (har qatorga bitta), muqova tanlovi.

Ota-ona tomonidagi yodlash, so'z o'yini va rasm qilib saqlash allaqachon tayyor. Backend faqat mazmunni to'g'ri formatda berishi kerak.

---

## 7. Frontendni API'ga ulash

`content.ts` dagi har bir hook'da `queryFn` almashtiriladi va `initialData` olib tashlanadi:

```ts
import { parentApi } from "@/lib/parent-api";

export function usePoems() {
  return useQuery({
    queryKey: ["useful", "poems"],
    queryFn: () => parentApi.get<Poem[]>("/app/parent/useful/poems"),
    staleTime: 5 * 60_000,
  });
}
```

> **Diqqat:** sahifalar hozir `data` doim bor deb hisoblaydi (namunaviy ma'lumot darhol keladi). API'ga ulangach, yuklanish paytida `data` bo'sh bo'ladi — sahifalarga `data ?? []` va yuklanish holatini qo'shish kerak. API tayyor bo'lgach aytsang, bu qismini Usmon bilan birga ulab beramiz.

---

## 8. Tekshirish

```bash
# Tarbiyachi sifatida kirish (cookie faylga saqlanadi)
curl -c t.txt -X POST http://localhost:4000/api/v1/app/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"orgSlug":"usmon","email":"<tarbiyachi email>","password":"<parol>"}'

# She'r qo'shish
curl -b t.txt -X POST http://localhost:4000/api/v1/app/useful/poems \
  -H 'Content-Type: application/json' \
  -d '{"title":"Sinov","ageFrom":3,"ageTo":6,"groupId":"<guruh id>","text":"Birinchi qator,\nIkkinchi qator.\n\nUchinchi qator,\nToʻrtinchi qator."}'

# Ota-ona sifatida ko'rish
curl -c p.txt -X POST http://localhost:4000/api/v1/app/parent/login \
  -H 'Content-Type: application/json' \
  -d '{"orgSlug":"usmon","phone":"<telefon>","password":"<parol>"}'
curl -b p.txt http://localhost:4000/api/v1/app/parent/useful/poems
```

Albatta tekshiriladigan holatlar:

- [ ] Boshqa guruhning ota-onasi guruhga xos she'rni ko'rmaydi, `/:id` — **404**.
- [ ] `DRAFT` va o'chirilgan mazmun ota-onaga ko'rinmaydi.
- [ ] O'qituvchi boshqa o'qituvchining guruhiga qo'sha olmaydi va boshqaning she'rini tahrirlay olmaydi — **403**.
- [ ] `FINANCE` va `NETWORK_ADMIN` yoza olmaydi — **403**.
- [ ] Boshqa tashkilot yoki filialning `groupId` si berilsa — **403** yoki **404**.
- [ ] Bo'sh qatorlar bilan yozilgan matn to'g'ri bandlarga ajraladi; 60 belgidan uzun qator — **400**.

---

## 9. Keyinroq (ixtiyoriy)

- **Yodlanganlar holati:** hozir "Yodladik!" belgilari faqat telefonda (localStorage) saqlanadi. Tarbiyachi kim nima yodlaganini ko'rishi uchun: `POST /app/parent/useful/progress { kind, id, learned }`.
- **Audio:** tarbiyachi she'rni o'z ovozida yozib yuklaydi, ota-ona tinglaydi.
- **Muqova:** ertakka o'z rasmini yuklash (filial logotipidagidek).
- **"Bugungi she'r":** hozir har kuni navbat bilan tanlanadi; tarbiyachi o'zi belgilashi mumkin bo'ladi.
