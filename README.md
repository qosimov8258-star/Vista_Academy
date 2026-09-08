# Bog'chalar tarmog'i — SaaS ERP

Ko'p-tenantli (multi-tenant) bog'chalar tarmog'i uchun ERP tizimi.

## Monorepo tuzilishi

```
apps/
  api/            NestJS backend (Prisma + PostgreSQL)
  platform-web/   Platforma boshqaruvi (Super Admin) — tashkilotlarni yaratish/kuzatish
  admin-web/      Tashkilot/filial admin paneli (Super Admin, Filial admini, Moliyachi, Administrator)
```

Uchta ilova bitta npm workspaces monorepo ichida (`apps/*`).

## Talablar

- Node.js 24+ va npm
- Docker (PostgreSQL uchun) — yoki mahalliy o'rnatilgan PostgreSQL 16

## O'rnatish

```bash
git clone <repo-url>
cd Vista_Academy
npm install
```

### 1. Ma'lumotlar bazasi

```bash
npm run db:up          # Docker orqali PostgreSQL'ni ishga tushiradi (5436-port)
```

### 2. Backend konfiguratsiyasi

```bash
cp apps/api/.env.example apps/api/.env
```

`apps/api/.env` faylidagi qiymatlar mahalliy ishlash uchun tayyor (`docker-compose.yml`dagi portga mos). Ishlab chiqarish (production) uchun barcha `change-me-...` maxfiy kalitlarni albatta almashtiring.

### 3. Migratsiyalarni qo'llash

```bash
npm run prisma:generate --workspace=apps/api
npm run prisma:deploy --workspace=apps/api   # mavjud migratsiyalarni qo'llaydi (tavsiya etiladi)
```

> **Eslatma**: `prisma:migrate` (`prisma migrate dev`) ba'zi PostgreSQL rollarida "shadow database" uchun `CREATEDB` huquqi talab qiladi va xatolik berishi mumkin. Agar sizning Postgres foydalanuvchingiz to'liq huquqlarga ega bo'lsa (masalan yangi Docker konteyneridagi `bogcha` foydalanuvchisi), `prisma:migrate` ham ishlaydi. Aks holda har doim `prisma:deploy`dan foydalaning. Sxemaga o'zgartirish kiritsangiz, yangi migratsiya faylini `prisma/migrations/` ichida qo'lda yozib, so'ng `prisma:deploy` bilan qo'llang — bu loyihada shu yondashuv qabul qilingan.

### 4. Boshlang'ich ma'lumot (super admin)

```bash
npm run prisma:seed --workspace=apps/api
```

Standart super admin: `admin@bogcha.uz` / `ChangeMe123!` (`.env`dagi `SEED_SUPER_ADMIN_*` orqali o'zgartiriladi).

### 5. Serverlarni ishga tushirish

Uchta alohida terminalda:

```bash
npm run dev:api      # http://localhost:4000 — backend API
npm run dev:web      # http://localhost:3000 — platforma (super admin) paneli
npm run dev:admin    # http://localhost:3001 — tashkilot/filial admin paneli
```

## Ishlash tartibi

1. `localhost:3000`ga super admin bilan kiring, yangi tashkilot (bog'chalar tarmog'i) yarating — bu avtomatik ravishda birinchi filial va "Super Admin" akkauntini yaratadi.
2. Yaratilgan tashkilotning login ma'lumotlari bilan `localhost:3001/{tashkilot-slug}/login`ga kiring.
3. "Filiallar" bo'limidan yangi filial va unga menejer yarating (login/parol bilan birga).

## Muhim arxitektura qoidalari

- **Rol ierarxiyasi va huquqlar** (enum qiymatlari qavs ichida — ekrandagi nom bilan bir xil emas):

  | Rol | Qamrov | Moliya + Ish haqi | Qolgan bo'limlar | Foydalanuvchi yaratadi |
  |---|---|---|---|---|
  | Super Admin (`NETWORK_ADMIN`) | butun tarmoq | ko'radi | ko'radi | filial admini, moliyachi |
  | Filial admini (`BRANCH_ADMIN`) | bitta filial | yozadi | yozadi | administrator |
  | Moliyachi (`FINANCE`) | bitta filial | **yozadi** | ko'radi | — |
  | Administrator (`MANAGER`) | bitta filial | yozadi | yozadi | — |

  Super Admin har bir filial uchun alohida filial admini va moliyachi tayinlaydi; ularning har biri faqat
  o'z filialini ko'radi. Yaratiladigan rol hech qachon so'rovdan olinmaydi — u `resolveTarget()` da
  chaqiruvchining roli bilan cheklanadi.
- **Yozish huquqi ikki darvozadan o'tadi** (`apps/api/src/modules/iam/tenant-auth.types.ts`):
  `requireBranchScope()` — Moliya va Ish haqi uchun (filialdagi barcha rollar),
  `requireOperationalScope()` — qolgan modullar uchun (moliyachi bu yerda faqat kuzatadi).
  `apps/admin-web/src/lib/permissions.ts` shu qoidani UI tomonda takrorlaydi — biri o'zgarsa ikkinchisi ham.
- **URL sxemasi**: `/{tashkilot-slug}` — tashkilot, `/{tashkilot-slug}/{filial-slug}` — filial darajasidagi ko'rinish (Super Admin uchun haqiqiy filial-skoup sahifa, filialdagi rollar uchun kosmetik/bookmark havola).
- **Migratsiyalar qo'lda yoziladi** (`prisma migrate dev` ishlatilmaydi) — sabab: shadow DB ruxsati muammosi. Yangi migratsiya qo'shsangiz, oldingi migratsiya fayllarining formatiga taqlid qiling.
- **`apps/admin-web/src/proxy.ts`** — Next.js middleware o'rnini bosuvchi maxsus routing fayli (bu loyihadagi Next.js versiyasida `middleware.ts` emas, `proxy.ts` ishlatiladi).
