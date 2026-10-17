/**
 * Bog'cha panelidagi barcha funksiyalar ro'yxati — platforma operatori
 * ularni tarif yoki alohida bog'cha uchun yoqadi/o'chiradi.
 *
 * Yangi funksiya qo'shish: shu yerga yozuv qo'shing (`paths` — `/api/v1/app/`
 * dan keyingi yo'l, regex). Tekshiruv TenantJwtAuthGuard'da markaziy
 * bajariladi, controller'larga tegish shart emas.
 */
/** Yo'l qoidasi: oddiy regex — har qanday metod; `methods` bilan — faqat shu metodlar (masalan rasm joylash PUT/DELETE). */
export type PathRule = RegExp | { methods: string[]; re: RegExp };

export interface FeatureDefinition {
  key: string;
  label: string;
  group: string;
  description: string;
  paths: PathRule[];
  /**
   * Forma maydonlari: shu yo'lga shu metod bilan so'rov tanasida (body) `names`
   * ichidagi maydon bo'sh bo'lmagan qiymat bilan kelsa — funksiya o'chiq bo'lganda rad etiladi.
   */
  fields?: { methods: string[]; re: RegExp; names: string[] }[];
  /**
   * Ichki funksiya: asosiy bo'lim kaliti. Asosiy bo'lim o'chirilsa, ichkilari
   * ham o'chiriladi (qiymatlari saqlanib qoladi, bo'lim qaytsa o'zlari qaytadi).
   */
  parent?: string;
}

const only = (methods: string[], re: RegExp): PathRule => ({ methods, re });

export const FEATURE_CATALOG: readonly FeatureDefinition[] = [
  // Qabul va bolalar
  { key: "crm", label: "CRM (arizalar)", group: "Qabul va bolalar", description: "Lidlar, arizalar va qabul bosqichlari", paths: [/^leads(\/|$)/] },
  { key: "attendance", label: "Bolalar davomati", group: "Qabul va bolalar", description: "Kunlik davomat va surunkali kelmaslik", paths: [/^attendance(\/|$)/, /^children\/[^/]+\/attendance-history/] },
  { key: "dailyReports", label: "Kunlik hisobotlar", group: "Qabul va bolalar", description: "Bola haqida kunlik hisobot", paths: [/^daily-reports(\/|$)/, /^children\/[^/]+\/daily-reports/] },
  { key: "development", label: "Rivojlanish baholari", group: "Qabul va bolalar", description: "Bola rivojlanishini baholash", paths: [/^development(\/|$)/, /^children\/[^/]+\/development/] },
  { key: "health", label: "Sog'liq", group: "Qabul va bolalar", description: "Sog'liq kartasi, emlash, dori, allergiya", paths: [/^children\/[^/]+\/(health|medications|quarantine|vaccinations|allergies)/, /^health\//, /^vaccinations\//] },
  { key: "childReminders", label: "Bola eslatmalari", group: "Qabul va bolalar", description: "Bolaga biriktirilgan eslatmalar", paths: [/^reminders(\/|$)/] },
  { key: "coins", label: "Koin tizimi", group: "Qabul va bolalar", description: "Koinlar va haftalik baholash", paths: [/^coins(\/|$)/] },
  { key: "pickups", label: "Olib ketish va qo'ng'iroqlar", group: "Qabul va bolalar", description: "Bugungi holat, olib ketish, qo'ng'iroqlar", paths: [/^desk(\/|$)/] },
  { key: "childCreate", label: "Bola qo'shish", group: "Qabul va bolalar", description: "Yangi bola kartochkasi yaratish", paths: [only(["POST"], /^children\/?$/)] },
  { key: "childEdit", label: "Bola ma'lumotini tahrirlash", group: "Qabul va bolalar", description: "Bola kartochkasidagi ma'lumotlarni o'zgartirish", paths: [only(["PATCH", "PUT"], /^children\/[^/]+\/?$/)] },
  { key: "childAvatar", label: "Bola rasmi", group: "Qabul va bolalar", description: "Rasm joylash va olib tashlash (ko'rish ochiq qoladi)", paths: [only(["PUT", "POST", "PATCH", "DELETE"], /^children\/[^/]+\/avatar/)] },
  { key: "childFieldBirthDate", label: "Bola formasi: tug'ilgan sana", group: "Qabul va bolalar", description: "Bola qo'shish va tahrirlash formasidagi tug'ilgan sana maydoni", paths: [], fields: [{ methods: ["POST", "PATCH", "PUT"], re: /^children(\/[^/]+)?\/?$/, names: ["birthDate"] }] },
  { key: "childFieldGender", label: "Bola formasi: jinsi", group: "Qabul va bolalar", description: "Forma maydoni; o'chirilsa jins so'ralmaydi va majburiy emas", paths: [], fields: [{ methods: ["POST", "PATCH", "PUT"], re: /^children(\/[^/]+)?\/?$/, names: ["gender"] }] },
  { key: "childFieldGuardianPassword", label: "Bola formasi: ota-ona kabineti paroli", group: "Qabul va bolalar", description: "Bola qo'shishdagi parol maydoni; o'chirilsa parol avtomatik beriladi", paths: [], fields: [{ methods: ["POST"], re: /^children\/?$/, names: ["guardianPassword"] }] },
  { key: "groupCreate", label: "Guruh yaratish", group: "Qabul va bolalar", description: "Yangi guruh ochish", paths: [only(["POST"], /^groups\/?$/)] },
  { key: "groupEdit", label: "Guruhni tahrirlash", group: "Qabul va bolalar", description: "Guruh ma'lumotlarini o'zgartirish", paths: [only(["PATCH", "PUT"], /^groups\/[^/]+\/?$/)] },

  // Moliya
  { key: "billing", label: "To'lovlar va hisob-fakturalar", group: "Moliya", description: "To'lov qabul qilish, hisob-faktura, qarzdorlar", paths: [/^invoices(\/|$)/, /^payments(\/|$)/, /^finance\/(children|summary)/, /^children\/[^/]+\/ledger/] },
  { key: "cash", label: "Kassa va xarajatlar", group: "Moliya", description: "Kassa, xarajatlar, oylik hisobot", paths: [/^cash(\/|$)/] },
  { key: "paymentReceipts", label: "To'lov cheklari", group: "Moliya", description: "Ota-ona yuborgan chek rasmlari", paths: [/^payment-receipts(\/|$)/, /^children\/[^/]+\/payment-receipts/] },
  { key: "paymentReminders", label: "To'lov eslatmalari", group: "Moliya", description: "Qarzdorlarga avtomatik eslatma", paths: [/^finance\/reminder-settings/] },
  { key: "discounts", label: "Chegirmalar", group: "Moliya", description: "Bola uchun chegirma qoidalari", paths: [/^discounts(\/|$)/] },
  { key: "products", label: "Mahsulotlar (do'kon)", group: "Moliya", description: "Mahsulot va sotuvlar", paths: [/^products(\/|$)/] },

  // Xodimlar
  { key: "employees", label: "Xodimlar bo'limi", group: "Xodimlar", description: "Xodimlar ro'yxati va kartochkasi — o'chirilsa ichidagi hamma amal ham o'chadi", paths: [/^employees(?:\/(?![^/]+\/(?:payroll|salary-scheme))|$)/] },
  { key: "employeeCreate", label: "Xodim qo'shish", group: "Xodimlar", description: "Yangi xodim kartochkasi yaratish", parent: "employees", paths: [only(["POST"], /^employees\/?$/)] },
  { key: "employeeDelete", label: "Xodimni o'chirish", group: "Xodimlar", description: "Xodimni butunlay olib tashlash", parent: "employees", paths: [only(["DELETE"], /^employees\/[^/]+\/?$/)] },
  { key: "employeeAvatar", label: "Xodim rasmi", group: "Xodimlar", description: "Rasm joylash va olib tashlash (ko'rish ochiq qoladi)", parent: "employees", paths: [only(["PUT", "POST", "PATCH", "DELETE"], /^employees\/[^/]+\/avatar/)] },
  { key: "employeeAccount", label: "Kirish akkaunti va parol", group: "Xodimlar", description: "Login/parol ochish, almashtirish va ko'rish", parent: "employees", paths: [/^employees\/[^/]+\/(account|password|credentials)/] },
  { key: "employeeGroups", label: "Guruhga biriktirish", group: "Xodimlar", description: "Tarbiyachini guruhlarga biriktirish", parent: "employees", paths: [only(["PATCH", "PUT", "POST"], /^employees\/[^/]+\/groups/)] },
  { key: "employeeTopics", label: "Dars mavzulari", group: "Xodimlar", description: "O'qituvchi mavzulari va ularni boshqarish", parent: "employees", paths: [/^employees\/[^/]+\/topics/] },
  { key: "hr", label: "Ish haqi (HR)", group: "Xodimlar", description: "Ish haqi, smenalar, to'lovlar", paths: [/^payroll(\/|$)/, /^shifts(\/|$)/, /^employees\/[^/]+\/(payroll|salary-scheme)/] },
  { key: "staffAttendance", label: "Xodimlar davomati", group: "Xodimlar", description: "Xodimlarning kelish-ketishi", paths: [/^staff-attendance(\/|$)/] },
  { key: "faceId", label: "Face ID", group: "Xodimlar", description: "Qurilmalar va yuz ro'yxati", paths: [/^face-id(\/|$)/] },
  { key: "employeeNotifications", label: "Xodim bildirishnomalari", group: "Xodimlar", description: "Xodimlarga ichki bildirishnoma", paths: [/^employee-notifications(\/|$)/] },

  // Kundalik ish
  { key: "nutrition", label: "Ovqatlanish", group: "Kundalik ish", description: "Menyu va taomlar", paths: [/^menu(\/|$)/, /^dishes(\/|$)/] },
  { key: "lessons", label: "Qo'shimcha darslar", group: "Kundalik ish", description: "Dars jadvali, xonalar, mavzu, davomat, baholar, fanlar", paths: [/^lesson-/, /^rooms(\/|$)/, /^subjects(\/|$)/, /^children\/[^/]+\/lesson-grades/] },
  { key: "useful", label: "Foydali bo'lim", group: "Kundalik ish", description: "She'r, maqol va ertaklar", paths: [/^useful(\/|$)/, /^parent\/useful/] },
  { key: "diary", label: "Kundalik (diary)", group: "Kundalik ish", description: "Bola kundaligi", paths: [/^diary(\/|$)/, /^parent\/diary/] },
  { key: "notifications", label: "Bildirishnomalar", group: "Kundalik ish", description: "Ota-onalarga xabar yuborish", paths: [/^notifications(\/|$)/, /^parent\/push/] },

  // Ota-onalar
  { key: "parentCabinet", label: "Ota-ona kabineti", group: "Ota-onalar", description: "Ota-onalar uchun shaxsiy kabinet", paths: [/^parent(\/|$)/, /^guardians\/[^/]+\/cabinet/] },
  { key: "guardians", label: "Vasiylar", group: "Ota-onalar", description: "Bolaning vasiylari ro'yxati", paths: [/^guardians(\/|$)/, /^child-guardians\//, /^children\/[^/]+\/guardians/] },

  // Boshqa
  { key: "landing", label: "Lending sayt boshqaruvi", group: "Boshqa", description: "Bog'cha saytini tahrirlash", paths: [/^landing(\/|$)/] },
  { key: "exports", label: "Eksport (Excel)", group: "Boshqa", description: "Ma'lumotlarni yuklab olish", paths: [/^exports(\/|$)/] },
  { key: "auditLogs", label: "Audit jurnali", group: "Boshqa", description: "Amallar tarixi", paths: [/^audit-logs(\/|$)/] },
] as const;

export const FEATURE_KEYS: readonly string[] = FEATURE_CATALOG.map((f) => f.key);

export type FeatureMap = Record<string, boolean>;

/**
 * Funksiyalarni alohida cheklash mumkin bo'lgan panellar: TenantUserRole
 * qiymatlari + ota-ona kabineti (PARENT).
 */
export const FEATURE_PANELS: readonly { key: string; label: string }[] = [
  { key: "NETWORK_ADMIN", label: "Super Admin" },
  { key: "BRANCH_ADMIN", label: "Filial admini" },
  { key: "MANAGER", label: "Administrator" },
  { key: "TEACHER", label: "O'qituvchilar" },
  { key: "FINANCE", label: "Moliyachi" },
  { key: "CHEF", label: "Oshpaz" },
  { key: "PARENT", label: "Ota-onalar" },
];

export const PANEL_KEYS: readonly string[] = FEATURE_PANELS.map((p) => p.key);

function toBooleanMap(value: unknown): FeatureMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: FeatureMap = {};
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

/** Bog'cha → panel: `panelOverrides` = {"TEACHER": {...}}; berilgan panelning o'z qismi olinadi. */
export function panelOverridesOf(panelOverrides: unknown, panel: string): FeatureMap {
  if (!panelOverrides || typeof panelOverrides !== "object" || Array.isArray(panelOverrides)) return {};
  return toBooleanMap((panelOverrides as Record<string, unknown>)[panel]);
}

/**
 * Yakuniy holat: panelning o'z qiymati → bog'chaning o'z qiymati → tarifdagi
 * qiymat → yoqilgan. Kalit yo'q bo'lsa yoqilgan hisoblanadi, shuning uchun
 * eski tariflar va yangi qo'shilgan funksiyalar hech narsani buzmaydi.
 */
export function resolveFeatures(planFeatures: unknown, overrides: unknown, panelOverrides?: unknown): FeatureMap {
  const plan = toBooleanMap(planFeatures);
  const own = toBooleanMap(overrides);
  const panel = toBooleanMap(panelOverrides);
  const result: FeatureMap = {};
  for (const key of FEATURE_KEYS) {
    result[key] = panel[key] ?? own[key] ?? plan[key] ?? true;
  }
  // Ichki funksiya asosiy bo'lim o'chiq bo'lsa ishlamaydi
  for (const feature of FEATURE_CATALOG) {
    if (feature.parent && result[feature.parent] === false) result[feature.key] = false;
  }
  return result;
}

/** `panel` — shu foydalanuvchi paneli (rol yoki "PARENT"); `allPanelOverrides` — bog'chadagi butun panelFeatureOverrides. */
export function disabledFeatureKeys(
  planFeatures: unknown,
  overrides: unknown,
  panel?: string,
  allPanelOverrides?: unknown,
): string[] {
  const resolved = resolveFeatures(
    planFeatures,
    overrides,
    panel ? panelOverridesOf(allPanelOverrides, panel) : undefined,
  );
  return FEATURE_KEYS.filter((key) => !resolved[key]);
}

/** `/api/v1/app/leads/5` → `leads/5`; `/app` dan tashqari yo'llar uchun null. */
function appRelativePath(url: string): string | null {
  const path = url.split("?")[0];
  const match = /^\/api\/v1\/app\/(.*)$/.exec(path);
  return match ? match[1] : null;
}

function ruleMatches(rule: PathRule, rel: string, method: string): boolean {
  if (rule instanceof RegExp) return rule.test(rel);
  return rule.methods.includes(method) && rule.re.test(rel);
}

/**
 * So'rov tegishli bo'lgan barcha funksiyalar (bo'lmasa — bo'sh ro'yxat,
 * ya'ni cheklanmaydi). Bir nechta bo'lishi mumkin: masalan xodim rasmi ham
 * "Xodim rasmi", ham "Xodimlar bo'limi"ga kiradi — birortasi o'chiq bo'lsa to'xtatiladi.
 */
export function featuresForRequest(url: string, method = "GET"): FeatureDefinition[] {
  const rel = appRelativePath(url);
  if (rel === null) return [];
  const m = method.toUpperCase();
  return FEATURE_CATALOG.filter((f) => f.paths.some((rule) => ruleMatches(rule, rel, m)));
}

function hasValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== "";
}

/** Tanasida o'chirilgan forma maydoni kelgan bo'lsa — shu funksiya, aks holda null. */
export function blockedFieldForRequest(
  url: string,
  method: string,
  body: unknown,
  disabled: readonly string[],
): { feature: FeatureDefinition; field: string } | null {
  if (disabled.length === 0 || !body || typeof body !== "object") return null;
  const rel = appRelativePath(url);
  if (rel === null) return null;
  const m = method.toUpperCase();
  const data = body as Record<string, unknown>;
  for (const feature of FEATURE_CATALOG) {
    if (!feature.fields || !disabled.includes(feature.key)) continue;
    for (const rule of feature.fields) {
      if (!rule.methods.includes(m) || !rule.re.test(rel)) continue;
      const field = rule.names.find((name) => hasValue(data[name]));
      if (field) return { feature, field };
    }
  }
  return null;
}

/** Shu so'rovni to'sib turgan (o'chirilgan) birinchi funksiya, yo'q bo'lsa null. */
export function blockedFeatureForRequest(url: string, method: string, disabled: readonly string[]): FeatureDefinition | null {
  if (disabled.length === 0) return null;
  return featuresForRequest(url, method).find((f) => disabled.includes(f.key)) ?? null;
}
