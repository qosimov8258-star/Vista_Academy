@AGENTS.md

# admin-web — dizayn qoidalari (iOS uslubi)

Bog'cha paneli **Apple iOS «inset grouped»** uslubida (iPhone «Sozlamalar»
ilovasidagidek) va egasining Sabot loyihasi bilan **bir xil ko'rinadi**. Hamma
yangi sahifa va tegiladigan UI shu uslubda qilinadi. Bu qoidalar faqat
`admin-web` uchun — `platform-web` o'z skinida qoladi.

**Qayta chizishda faqat ko'rinish o'zgaradi.** Ma'lumot, so'rovlar, havolalar,
bo'limlar tartibi va xulq (UX) o'zgarmaydi; hech bir funksiya olib tashlanmaydi.
O'zgarishdan oldin sahifadagi funksiyalarni ro'yxatga oling, keyin hammasini
tekshiring.

## Tayyor qismlar — avval shularni ishlating, nusxa yozmang

| Nima | Qayerda |
| --- | --- |
| Ranglar va klasslar (`IOS`, `PAGE_CARD`, `GROUP_BLOCK`, `SECTION_TITLE`, `ROW_SEPARATOR`) | `src/components/ios/tokens.ts` |
| Bo'lim + qatorlar (`Group`, `GroupLink`, `Row`, `ListRow`) | `src/components/ios/group.tsx` |
| Sahifa kartasi va sarlavha kartasi (`PageCard`, `PageHeaderCard`) | `src/components/ios/page-card.tsx` |
| Kapsula tugma (`IosButton`, `compact` — telefonda faqat ikonka) | `src/components/ios/button.tsx` |
| Holat kapsulasi va avatar (`Pill`, `IosAvatar`) | `src/components/ios/pill.tsx` |
| Ko'rsatkichlar tasmasi (`StatStrip`, `StatCell`) | `src/components/ios/stat-strip.tsx` |
| Oyna (`IosSheet`) | `src/components/ios/sheet.tsx` |
| Skelet, bo'sh va xato holatlari | `src/components/ios/states.tsx` |
| Plitka (`IosIcon`, `IosTint`) | `src/features/director/ios-icon.tsx` |
| Ikonkalar (lucide, eski nomlar bilan) | `src/components/ios/icons.ts` |

Namuna sahifalar: `features/director/director-home.tsx` (Super Admin dashboard),
`features/branch-admin/branch-admin-home.tsx`, `app/(dashboard)/[slug]/children/page.tsx`.

## 1. Ranglar — faqat iOS tizim ranglari

green `#34C759` · orange `#FF9500` · red `#FF3B30` · blue `#007AFF` ·
purple `#AF52DE` · indigo `#5856D6` · teal `#30B0C7` · pink `#FF2D55` ·
mint `#00C7BE` · gray `#8E8E93`.

- Tint (yorliq foni) — rangning 12–15% i; matn — o'sha rangning o'zi.
- Kulrang to'ldirish (ikkilamchi tugma, segment yo'lagi, qidiruv): `bg-[#767680]/[0.12]`.
- Karta — oq; sheet foni — `#F2F2F7`; ikkilamchi matn — `#8E8E93`.
- Tizim (brend) rangi — `var(--color-primary)`, faqat asosiy tugma va tanlangan holat uchun.
- Tailwind palitrasi (`emerald-500`, `rose-50`…), gradient, neon **ishlatilmaydi**.
- O'zgaruvchidan keladigan rang — **inline `style`** bilan (`bg-[${hex}]` ni Tailwind yig'maydi).
- Panelda qorong'i rejim hali yo'q — `dark:` yozilmaydi (butun panel uchun birdaniga qo'shiladi).

## 2. Tipografiya

- Sahifa/sheet sarlavhasi — 20px bold; katta salomlashuv — 28px bold.
- Qator matni — 15–16px; izoh — 13px `#8E8E93`; mayda — 12–12.5px.
- Bo'lim sarlavhasi (kartadan **tashqarida**) — 13px, `uppercase`, `tracking-wide`, `#8E8E93` (`SECTION_TITLE`).
- Raqamlar — `tabular-nums`; katta ko'rsatkich — 28–32px bold.
- **Yo'q:** `font-black`, 10–11px qalin `uppercase tracking-widest` yorliqlar.

## 3. Kartalar va qatorlar

- Karta: oq, `rounded-[18px]`, **chegara ham, soya ham yo'q** (`PAGE_CARD`, `GROUP_BLOCK`). Bloklar orasi 20px (`space-y-5`).
- Ro'yxat — bitta karta ichidagi qatorlar, har biri alohida karta emas.
- Ajratgich — 1px `black/8%`, birinchi qatorda yo'q, **matn boshlanadigan joydan**:
  30px plitkali qatorda 58px, 44px avatarli qatorda 72px, oddiy qatorda 16px
  (`Row`/`ListRow` buni o'zi qiladi).
- Qator: min 48–64px, chapda plitka/avatar, o'rtada nom (15px) + izoh (13px, `truncate`),
  o'ngda qiymat yoki `Pill`, oxirida «›».
- **Qatorda amal tugmasi (qalam, axlat qutisi) yo'q** — qator bosiladi, amallar sheet ichida.

## 4. Plitkalar va ikonkalar

- Plitka — **tekis tizim rangi + oq ikonka**, gradient/yorug'lik/soya yo'q (`IosIcon`).
  Qatorda 30px (burchak 8px), karta boshida 40px (12px), bo'sh holatda 48px.
  Ikonka — plitkaning yarmi. Har bo'limning o'z rangi.
- Ikonkalar — **faqat lucide** (`strokeWidth` 2), `@/components/ios/icons` orqali yoki
  to'g'ridan-to'g'ri `lucide-react` dan. Emoji va qo'lda chizilgan SVG yo'q.
  Ma'no: bola — Baby, guruh — UsersRound, filial — School, xodim — IdCard,
  pul — Wallet, qarz — ReceiptText, hisobot — ChartColumn, audit — ShieldCheck,
  sozlama — Settings, yangilash — RefreshCw.
- Menyu ikonkalari (yon panel, telefon «Menyu»si, pastki tab panel) —
  `components/layout/nav-icons.tsx`: lucide belgi + har birining o'z rangi.
  Yon panel va «Menyu»da `NavTile` plitkasida, pastki tab panelda bir rangli
  belgi; faol bo'lim qalinroq chiziq bilan. Yangi bo'lim ikonkasi shu faylga qo'shiladi.

## 5. Tugmalar, segment, kapsula

- Hamma tugma — kapsula (`rounded-full`), `IosButton`: `primary` (tizim rangi) yoki `pill` (kulrang).
  Sahifada bitta asosiy amal. Karta sarlavhasidagi tugmalar `compact` — telefonda faqat ikonka.
- Sheet footer'ida — `flex-1`, chapda «Bekor» (kulrang), o'ngda asosiy; xavfli amal — qizil.
- Segment (2–4 variant): `flex rounded-full p-[3px]` + kulrang to'ldirish; tanlangani `bg-white shadow-sm`, qolganlari `#8E8E93`.
- Holat/son — `Pill` (tint fon + rangli matn).

## 6. Sahifa tuzilishi

- Tepada `PageHeaderCard`: 40px plitka (telefonda yashiriladi), 20px nom, kulrang son kapsulasi + izoh, o'ngda tugmalar.
- Dashboard: KPI kartalari (30px plitka + nom, 28px qiymat, yonida ▲▼ `Pill`, izoh, ixtiyoriy chiziq) —
  kompyuterda 4 ta, telefonda 2×2; grafik ustunlari `rounded-[8px]`, joriy davr tizim rangida,
  o'tganlari uning 35% i; progress chizig'i `h-2 rounded-full` kulrang fonda.

## 7. Oynalar — doim `IosSheet`

- Telefonda pastdan, kompyuterda markazda; Esc/fon bilan yopiladi, saqlash paytida emas.
- **Tasdiqlash** — sheet ichida ikkinchi bosqich (qizil-tint izoh + «Qoldirish» / «O'chirish»).
  Brauzerning `confirm()` va eski `Modal`/dialoglar ishlatilmaydi.
- Yopilish animatsiyasida ichi bo'shamasin — oxirgi ko'rsatilgan qiymat saqlab turiladi.

## 8. Tanlash — native `<select>` YO'Q

Kompyuterda u macOS'ning qora ro'yxatini ochadi (yashirin `opacity-0` select ham).
≤ 6 variant — kapsula/plitka radio to'ri; ko'p variant — qator → ichki sheet ro'yxati,
tanlangani ✓ bilan, tanlangach o'zi yopiladi.
(Ma'lum qarz: `components/ios/form.tsx`, `filters.tsx` va o'qituvchining «Foydali»
sahifasida hali native select bor — tegilganda almashtiriladi.)

## 9. Formalar va holatlar

- Maydonlar — karta ichidagi qatorlar: chapda nom, o'ngda chegarasiz maydon.
- Summa — katta maydon (`h-14 rounded-[14px]`, 24px bold), «1 250 000» ko'rinishida, `inputMode="numeric"`.
- Xato — qizil `ring` + 13px qizil matn. Majburiy maydon to'lmaguncha asosiy tugma o'chiq.
- Yuklanish — haqiqiy qator o'lchamidagi skelet (butun ekran spinneri emas); qayta yuklashda eski ma'lumot qoladi.
- Bo'sh holat — kulrang plitka + sarlavha + izoh; xato — qizil + «Qayta urinish».

## 10. Telefon

375px da gorizontal surilish yo'q; uzun matn `truncate`/`min-w-0`; keng jadval faqat
o'z `overflow-x-auto` ichida; telefonda ikkinchi darajali ma'lumot yashiriladi;
bosiladigan joy kamida 44px.

## 11. Matnlar

Matn kalit sifatida o'zbekcha yoziladi va `tr()` bilan o'raladi; yangi matnning rus va
ingliz tarjimasi `messages/dict.ru.json` va `messages/dict.en.json` ga qo'shiladi.

## 12. Tekshirish

- `npx tsc --noEmit` (shu papkada) toza bo'lsin; eslint sozlanmagan.
- Brauzerda kompyuter va 375px telefon o'lchamida ochib ko'ring: surilish yo'q, matn
  qirqilmagan, sheet/tasdiqlash/bo'sh/yuklanish holatlari ishlaydi.
- Haqiqiy ma'lumotni saqlamasdan tekshiring (yozish so'rovlarini brauzerda ushlab qoling).
- Hisobotda nima o'zgargani, nima ataylab qoldirilgani va nima tekshirilmagani aytilsin.
