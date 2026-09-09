# Vista Academy — jamoa qoidalari

Bu faylni loyihadagi har bir Claude Code seansi avtomatik o'qiydi.
Loyihada bir necha kishi ishlaydi, shuning uchun quyidagilar **majburiy**.

---

## 1. Git tartibi — eng muhimi

### To'g'ri push qilish

`main` ga **hech qachon to'g'ridan-to'g'ri push qilinmaydi**. Har doim:

```bash
# 1. Ish boshlashdan OLDIN — main dan yangilikni oling
git checkout main
git pull origin main

# 2. O'z vetkangizni oching (nomi ish haqida gapirsin)
git checkout -b feature/moliya-hisoboti

# 3. Ishlang, kichik-kichik commit qiling

# 4. Push qilishdan OLDIN — main ni yana torting va birlashtiring
git checkout main && git pull origin main
git checkout feature/moliya-hisoboti
git merge main
#    konflikt chiqsa — SHU YERDA hal qiling, PR da emas

# 5. Ikkala ilovani ham yig'ib ko'ring
npm run build --workspace=apps/api
npm run build --workspace=apps/admin-web
npm run build --workspace=apps/platform-web

# 6. Endi push va PR
git push -u origin feature/moliya-hisoboti
```

Keyin GitHub'da PR ochiladi, kimdir ko'rib chiqadi, so'ng `main` ga birlashtiriladi.

### Har kuni `main` dan torting

Bu eng ko'p vaqt tejaydigan odat. Bir kunlik farq — 5 daqiqalik konflikt,
bir haftalik farq — yarim kunlik ish.

```bash
git checkout main && git pull && git checkout - && git merge main
```

### Vetkalarni to'g'ridan-to'g'ri solishtirmang

`git diff main mening-vetkam` **chalg'itadi**: u sizning vetkangizda hali
yo'q fayllarni "o'chirilgan" deb ko'rsatadi. To'g'risi — ajratish nuqtasidan:

```bash
git diff $(git merge-base main mening-vetkam) mening-vetkam
git log main..mening-vetkam --oneline    # faqat mening commitlarim
```

### Vetka nomlari

`sas`, `test`, `yangi` emas. `feature/...`, `fix/...` — nomdan ish ko'rinsin.

---

## 2. Kim qayerda ishlaydi

| Papka | Nima | Egasi |
|---|---|---|
| `apps/platform-web` (3100) | Platforma admin paneli — tashkilotlar, tariflar, obunalar | islombel |
| `apps/admin-web` (3101) | Bog'cha paneli — Super Admin, filial, tarbiyachi | Usmon |
| `apps/api` (4000) | NestJS backend | **umumiy** |

**O'z hududingizdan tashqariga chiqsangiz — avval ayting.** Barcha
to'qnashuvlar shu qoida buzilganda chiqadi.

---

## 3. `apps/api` — eng xavfli joy

Bu yerda hammamiz ishlaymiz. Uchta qoida:

### Prisma sxemasi

`prisma/schema.prisma` ga tegishdan **oldin ogohlantiring**: qaysi modelga,
qanday maydon. Ikki kishi bir modelga tegsa, konfliktni noto'g'ri hal qilish
bazani buzadi.

### Migratsiya

```bash
# TO'G'RI — migratsiya faylini qo'lda yozib, keyin:
npx prisma migrate deploy --workspace=apps/api
npx prisma generate --workspace=apps/api
```

**`prisma migrate dev` ISHLATMANG** — u shadow bazani talab qiladi, bizning
sozlamada ruxsat yo'q va u mavjud migratsiyalarni qayta yozib yuborishi mumkin.

Migratsiya papkasi nomi: `YYYYMMDDHHMMSS_qisqa_izoh`.

### Birlashtirgandan keyin

`main` ni tortib olgan har safar:

```bash
npm install                      # yangi paketlar bo'lsa
npx prisma migrate deploy --workspace=apps/api
npx prisma generate --workspace=apps/api
```

Aks holda sizning bazangizda ustun yetishmay, tushunarsiz xatolar chiqadi.

---

## 4. Lokal ishga tushirish

Portlar **doim** shu — 3000/3001 boshqa loyiha egallagan:

| Xizmat | Port |
|---|---|
| API | 4000 |
| platform-web | 3100 |
| admin-web | 3101 |
| PostgreSQL | 5436 |

`package.json` dagi `dev` skriptlari 3000/3001 ni ko'rsatadi — **portni qo'lda bering**:

```bash
npm run start:dev --workspace=apps/api                    # 4000
npx next dev -p 3100    # apps/platform-web ichida
npx next dev -p 3101    # apps/admin-web ichida
```

Docker ishlatilmaydi — Postgres qo'lda 5436 portda ishga tushiriladi.

---

## 5. PR qoidalari

- **Kichik bo'lsin.** 40+ fayl, 1500 qatorli bitta PR — ko'rib chiqib bo'lmaydi
  va konflikti ko'p. Har bir tugallangan bo'lak alohida PR.
- **Yig'ilishi shart.** PR ochishdan oldin uchala build ham o'tsin.
- **Kimdir o'qisin.** O'zingiz ochib, o'zingiz birlashtirmang.
- **Commit matni o'zbekcha**, nima qilingani va **nega** qilingani yozilsin.

---

## 6. Claude Code uchun alohida

Agar siz bu loyihada ishlayotgan Claude bo'lsangiz:

- **Ish doirasidan chiqmang.** Foydalanuvchi qaysi ilova ustida ishlayotganini
  aniqlang. Umumiy fayllarga (`apps/api`, `prisma/schema.prisma`,
  `components/ui/*`) tegish kerak bo'lsa — **oldin aytib qo'ying**, chunki
  o'zgarish boshqa dasturchining ishiga ham tegadi.
- **Migratsiyani `migrate dev` bilan yaratmang** (yuqoriga qarang).
- **Portlarni o'zgartirmang.**
- **Push qilishdan oldin so'rang.** Foydalanuvchi aytmaguncha push qilmang.
- **Tekshirmasdan "ishladi" demang.** O'zgarishni haqiqatan ishga tushirib
  ko'ring; test yiqilsa — natijani ochiq ayting.
