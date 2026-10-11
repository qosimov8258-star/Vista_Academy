export type TenantUserRole = "NETWORK_ADMIN" | "BRANCH_ADMIN" | "FINANCE" | "MANAGER" | "TEACHER" | "CHEF";

/** Kirish sahifasida ko'rsatiladigan ochiq ma'lumot (token talab qilinmaydi). */
export interface PublicOrganization {
  name: string;
  slug: string;
}

export interface TenantAuthenticatedUser {
  id: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  branchId: string | null;
  branchSlug: string | null;
  branchName: string | null;
  login: string;
  fullName: string;
  role: TenantUserRole;
  /** Profil rasmi bor bo'lsa — oxirgi yangilangan vaqti (kesh uchun). */
  avatarUpdatedAt: string | null;
  /** Sozlamalarda tanlangan tizim rangi ("blue" va h.k.); null — sukut (yashil). Hisobda saqlanadi. */
  themeColor: string | null;
  /** Bog'langan xodim kartochkasidagi lavozim (masalan "Fan o'qituvchisi", "Oshpaz"). Xodimga bog'lanmagan hisoblarda (Super Admin, moliyachi) — null. */
  position: string | null;
  /** "Fan o'qituvchisi" lavozimida tanlangan fan(lar). Boshqa lavozimlarda/bog'lanmagan hisoblarda — bo'sh massiv. */
  subjects: string[];
  /** Administrator xodim tafsilotida "Mavzu qo'shasizmi?"ni yoqib saqlagan bo'lsa — true. Shu holatda o'qituvchi "Savol-javob"ga o'zi mavzu qo'sha olmaydi. */
  topicsManagedByAdmin: boolean;
  /** Platforma operatori "Bog'chaga kirish" bilan kirgan bo'lsa — operator ismi. */
  impersonatedBy?: string | null;
}

export type OrganizationStatus = "ACTIVE" | "SUSPENDED" | "ARCHIVED";

export interface Branch {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  address: string | null;
  timezone: string;
  currency: string;
  openTime: string | null;
  closeTime: string | null;
  defaultTuitionAmount: string | null;
  createdAt: string;
  /** Belgisi bor bo'lsa — oxirgi yangilangan vaqti (rasm keshini yangilash uchun). */
  avatarUpdatedAt: string | null;
  avatarMimeType: string | null;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  createdAt: string;
  branches: Branch[];
  /** Faqat Super Admin'ga (filial rollaridan yashirin) — platforma obunasi. */
  subscription?: {
    status: "ACTIVE" | "GRACE_PERIOD" | "SUSPENDED" | "CANCELLED";
    currentPeriodEnd: string;
    graceUntil: string | null;
    trialEndsAt: string | null;
    plan: { name: string; priceMonthly: string };
  } | null;
  /** Faqat Super Admin'ga — platforma hamyoni (obuna to'lovi shundan yechiladi). */
  wallet?: { balance: string; currency: string } | null;
  /** Faqat Super Admin'ga — obuna hamyondan avtomatik yangilanadimi (platformada yoqilgan). */
  billingAutoRenew?: boolean;
}

export type GroupStatus = "ACTIVE" | "INACTIVE";

export interface GroupTeacherLink {
  groupId: string;
  employeeId: string;
  employee?: { id: string; fullName: string; position: string };
  branch?: { id: string; name: string };
  group?: { id: string; name: string };
}

export interface Group {
  id: string;
  branchId: string;
  name: string;
  capacity: number;
  status: GroupStatus;
  createdAt: string;
  _count?: { children: number };
  teachers?: GroupTeacherLink[];
}

export type ChildStatus = "ACTIVE" | "INACTIVE" | "QUARANTINED";

export type Gender = "MALE" | "FEMALE";

/** Guruh kartochkasidagi bola (guruh ko'rinishi uchun qisqartirilgan). */
export interface GroupChild {
  id: string;
  publicId: number;
  fullName: string;
  gender: Gender | null;
  birthDate: string | null;
  status: ChildStatus;
}

/** `GET /app/groups/:id/overview` javobi. */
export interface GroupOverview {
  group: { id: string; name: string; capacity: number; status: GroupStatus; createdAt: string };
  branch: { id: string; name: string };
  teachers: { id: string; fullName: string; position: string; isActive: boolean }[];
  children: {
    total: number;
    active: number;
    boys: number;
    girls: number;
    unknownGender: number;
    items: GroupChild[];
  };
}

/** `GET /app/groups/:id/attendance` javobi. */
export interface GroupAttendanceRange {
  from: string;
  to: string;
  totalChildren: number;
  days: { date: string; present: number; absent: number; unmarked: number }[];
  children: { childId: string; fullName: string; present: number; absent: number; rate: number | null }[];
}

export interface Child {
  id: string;
  organizationId: string;
  /** Xodimlar va ota-onalar ishlatadigan qisqa raqam; UI da "id12345" ko'rinishida. */
  publicId: number;
  branchId: string;
  groupId: string | null;
  firstName: string;
  lastName: string;
  /** "Familiya Ism" — qidiruv va ro'yxatlar shu maydonni ishlatadi. */
  fullName: string;
  /** Migratsiyadan oldin qo'shilgan bolalarda noma'lum bo'lishi mumkin. */
  gender: Gender | null;
  birthDate: string | null;
  status: ChildStatus;
  quarantineUntil: string | null;
  quarantineReason: string | null;
  /** Surati bor bo'lsa — oxirgi yangilangan vaqti (rasm keshini yangilash uchun). */
  avatarUpdatedAt: string | null;
  createdAt: string;
  group?: { id: string; name: string } | null;
  branch?: { id: string; name: string };
  /** Asosiy vasiy birinchi bo'lib keladi. */
  guardians?: ChildGuardian[];
}

/** Bola yaratilganda ota-onaning kabineti ochilsa — shu javobda bir marta keladi. */
export interface ChildCredentials {
  login: string;
  password: string;
}

export type CreateChildResult = Child & { credentials: ChildCredentials | null };

export interface Employee {
  id: string;
  organizationId: string;
  branchId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone: string | null;
  position: string;
  /** Faqat "Fan o'qituvchisi" lavozimida to'ldiriladi. */
  subjects: string[];
  /** Yuz tanish terminalidagi (Face ID) raqami — 1001, 1002, … */
  employeeNo: string;
  isActive: boolean;
  createdAt: string;
  avatarUpdatedAt: string | null;
  /** "Mavzu qo'shasizmi?" almashtirgichi — yoqiq bo'lsa, xodimning o'zi "Savol-javob"ga mavzu qo'sha olmaydi. */
  topicsManagedByAdmin: boolean;
  /** Kabineti bo'lmagan xodimda null — u tizimga kirmaydi. */
  tenantUser?: { id: string; login: string; role: TenantUserRole; isActive: boolean } | null;
  teachingGroups?: GroupTeacherLink[];
  /** Oylik sxemasi — ro'yxat bilan birga keladi, alohida so'rov kerak emas. */
  salaryScheme?: { ruleType: "FIXED" | "PER_HOUR" | "PER_CHILD"; fixedAmount: string; rate: string } | null;
}

export interface Position {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
}

export interface Subject {
  id: string;
  organizationId: string;
  name: string;
  createdAt: string;
}

/** Kabinet ochilganda login/parol avtomatik generatsiya qilinadi — faqat shu javobda bir marta keladi. */
export interface EmployeeCredentials {
  login: string;
  password: string;
}

export interface CreateEmployeeResult {
  employee: Employee;
  credentials: EmployeeCredentials | null;
}

export type FaceIdDeviceStatus = "ACTIVE" | "INACTIVE" | "MAINTENANCE";
export type FaceEnrollmentStatus = "PENDING" | "REGISTERED" | "FAILED" | "REMOVED";
export type FacePersonType = "EMPLOYEE" | "CHILD";

/** Face ID qurilmasi — masalan Hikvision DS-K1T342MX turniket terminali. */
export interface FaceIdDevice {
  id: string;
  organizationId: string;
  branchId: string;
  name: string;
  model: string;
  serialNumber: string | null;
  ipAddress: string | null;
  /** ISAPI (HTTP) porti */
  port: number;
  /** Qurilma administratori logini (parolning o'zi hech qachon kelmaydi) */
  username: string | null;
  hasPassword: boolean;
  hasAgentToken: boolean;
  /** Agent oxirgi marta murojaat qilgan payt */
  lastSeenAt: string | null;
  /** Qurilmaga hali yetib bormagan buyruqlar soni */
  queuedCommands: number;
  location: string | null;
  status: FaceIdDeviceStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  branch?: { id: string; name: string };
}

export type FaceIdCommandType = "ADD_OR_UPDATE_USER" | "SET_FACE" | "DELETE_USER";
export type FaceIdCommandStatus = "PENDING" | "SENT" | "DONE" | "FAILED";

/** Qurilmaga yuborilgan buyruq (`GET /app/face-id/devices/:id/commands`). */
export interface FaceIdCommand {
  id: string;
  type: FaceIdCommandType;
  status: FaceIdCommandStatus;
  employeeNo: string;
  attempts: number;
  lastError: string | null;
  createdAt: string;
  completedAt: string | null;
  employee: { id: string; fullName: string } | null;
  child: { id: string; fullName: string } | null;
}

/** Xodim yoki bolaning bitta qurilmada yuzini ro'yxatga olish holati. */
export interface FaceEnrollment {
  id: string;
  organizationId: string;
  branchId: string;
  deviceId: string;
  personType: FacePersonType;
  employeeId: string | null;
  childId: string | null;
  status: FaceEnrollmentStatus;
  notes: string | null;
  registeredAt: string | null;
  createdAt: string;
  updatedAt: string;
  device: { id: string; name: string };
  employee?: { id: string; fullName: string; avatarUpdatedAt: string | null } | null;
  child?: { id: string; fullName: string; avatarUpdatedAt: string | null; gender: "MALE" | "FEMALE" | null } | null;
}

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "SICK";

export interface AttendanceChild {
  childId: string;
  fullName: string;
  groupName: string | null;
  gender: "MALE" | "FEMALE" | null;
  /** Surati bor bo'lsa — oxirgi yangilangan vaqti (rasm keshini yangilash uchun). */
  avatarUpdatedAt: string | null;
  status: AttendanceStatus | null;
  note: string | null;
  /** Ota-ona kabinetida yozib qoldirgan sabab — tarbiyachining `note`sidan alohida. */
  parentReason: string | null;
  /** Tarbiyachi "Aloqaga chiqish" bosgan payt (ISO) — bosilmagan bo'lsa `null`. */
  contactRequestedAt: string | null;
  /** Yuz tanish terminali (Face ID) yozgan kelish/ketish vaqti ("HH:MM") — qo'lda belgilanganda `null`. */
  checkInTime: string | null;
  checkOutTime: string | null;
}

export interface AttendanceDay {
  date: string;
  children: AttendanceChild[];
}

/** `GET /app/coins/children` javobidagi bitta qator — bolaning joriy coin balansi. */
export interface CoinChildBalance {
  childId: string;
  fullName: string;
  gender: "MALE" | "FEMALE" | null;
  avatarUpdatedAt: string | null;
  groupName: string | null;
  balance: number;
  /** Kunlik davomatdan (har kelgan kuniga 5 coin) yig'ilgan jami. */
  attendanceCoins: number;
  /** Haftalik savol-javob + she'r yodlashdan yig'ilgan jami. */
  weeklyAssessmentCoins: number;
}

/** Coin qaysi avtomatik manbadan berilganini bildiradi — hech qachon qo'lda emas. */
export type CoinTransactionSource = "ATTENDANCE" | "WEEKLY_ASSESSMENT" | "MANUAL";

/** `GET /app/coins/children/:childId/transactions` ro'yxatidagi bitta yozuv. */
export interface CoinTransaction {
  id: string;
  amount: number;
  reason: string;
  source: CoinTransactionSource;
  createdAt: string;
}

/** `GET /app/coins/weekly-assessments/questions` javobidagi bitta mavzu guruhi. */
export interface WeeklyAssessmentQuestionGroup {
  topicId: string;
  topicTitle: string;
  topicDate: string;
  questions: TopicQuestion[];
}

/** `GET /app/coins/children/:childId/weekly-assessments` ro'yxatidagi bitta yozuv. */
export interface WeeklyCoinAssessment {
  id: string;
  weekStart: string;
  poemRecited: boolean;
  coinsAwarded: number;
  employee: { fullName: string } | null;
  answers: { question: { question: string }; correct: boolean }[];
}

/** `GET /app/products` javobidagi bitta qator — coin do'konidagi tovar. */
export interface Product {
  id: string;
  branchId: string;
  name: string;
  description: string | null;
  color: string | null;
  priceCoins: number;
  quantity: number;
  hasImage1: boolean;
  hasImage2: boolean;
  hasImage3: boolean;
  /** Surat(lar)ning oxirgi yangilangan vaqti — brauzer keshini yangilash uchun so'rov satriga qo'shiladi. */
  imagesUpdatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /app/attendance/chronic-absences` javobi — Davomat sahifasidagi ogohlantirish uchun. */
export interface ChronicAbsenceFlag {
  childId: string;
  fullName: string;
  consecutiveAbsentDays: number;
  overdueAndAbsentToday: boolean;
}

/** `GET /app/attendance/summary` javobi — filial darajasidagi kunlik statistika. */
export interface AttendanceRangeSummary {
  from: string;
  to: string;
  totalChildren: number;
  days: { date: string; present: number; absent: number; unmarked: number }[];
}

export interface ChildAttendanceHistory {
  /** Statistika shu yil bo'yicha hisoblanadi. */
  year: number;
  stats: {
    present: number;
    absent: number;
    /** Izohi bor kelmagan kunlar — sababli. */
    excusedAbsent: number;
    /** Izohsiz kelmagan kunlar — sababsiz. */
    unexcusedAbsent: number;
    /** Foizda, belgilangan kunlar orasida. Hech narsa belgilanmagan bo'lsa — null. */
    attendanceRate: number | null;
  };
  /** Shu yildagi barcha belgilangan kunlar, sanasi bo'yicha o'sish tartibida — kalendarni bo'yash va kelmagan kunlar ro'yxatini chiqarish uchun. */
  records: { date: string; status: AttendanceStatus; note: string | null }[];
}

export type InvoiceStatus = "PENDING" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CANCELLED";

export interface Invoice {
  id: string;
  organizationId: string;
  branchId: string;
  childId: string;
  amount: string;
  discountAmount: string;
  paidAmount: string;
  currency: string;
  period: string;
  dueDate: string;
  status: InvoiceStatus;
  paidAt: string | null;
  createdAt: string;
  child?: { id: string; fullName: string };
  /** Status bazada OVERDUE bo'lib yozilmaydi — server har safar hisoblab qo'shadi. */
  overdue: boolean;
}

/** `GET/PUT /app/finance/reminder-settings` javobi. */
export interface PaymentReminderSettings {
  id: string;
  organizationId: string;
  branchId: string;
  isEnabled: boolean;
  daysBeforeDue: number;
  daysAfterDue: number;
  sendTimes: string[];
  messageTemplate: string;
  updatedAt: string;
}

/** `GET /app/finance/reminder-settings/unpaid-children` satri. */
export interface UnpaidReminderChild {
  childId: string;
  childFullName: string;
  groupName: string | null;
  invoiceId: string;
  dueDate: string;
  amount: string;
  paidAmount: string;
  remainingAmount: string;
  /** Manfiy bo'lsa — kechikkan kunlar soni. */
  daysUntilDue: number;
  status: InvoiceStatus;
}

export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "CARD" | "CLICK" | "PAYME" | "UZUM" | "MOBILE_APP" | "BANKOMAT" | "OTHER";
export type PaymentStatus = "COMPLETED" | "REFUNDED";

export interface Payment {
  id: string;
  organizationId: string;
  branchId: string;
  childId: string;
  amount: string;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  note: string | null;
  refundedAt: string | null;
  createdAt: string;
  child?: { id: string; fullName: string };
}

/** Ota-ona to'lov cheki uchun tanlashi mumkin bo'lgan usullar — naqd/karta bu yerda yo'q. */
export const RECEIPT_PAYMENT_METHODS: PaymentMethod[] = ["CLICK", "PAYME", "MOBILE_APP", "BANKOMAT", "OTHER"];

export type PaymentReceiptStatus = "PENDING" | "APPROVED" | "REJECTED";

/** Ota-ona kabinetidan yuklangan to'lov cheki — moliyachi tasdiqlagunga qadar balansga ta'sir qilmaydi. */
export interface PaymentReceipt {
  id: string;
  childId: string;
  guardianId: string;
  claimedAmount: string;
  currency: string;
  status: PaymentReceiptStatus;
  reviewNote: string | null;
  reviewedByUserId: string | null;
  reviewedAt: string | null;
  paymentId: string | null;
  createdAt: string;
  guardian?: { fullName: string };
}

export type LedgerEntryType = "CHARGE" | "DISCOUNT" | "PAYMENT" | "REFUND" | "ADJUSTMENT";

export interface LedgerEntry {
  id: string;
  childId: string;
  type: LedgerEntryType;
  amount: string;
  note: string | null;
  createdAt: string;
  invoice?: { id: string; period: string } | null;
  payment?: { id: string; method: PaymentMethod; status: PaymentStatus } | null;
}

export interface TenantUser {
  id: string;
  login: string;
  fullName: string;
  role: TenantUserRole;
  branchId: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  branch: { id: string; name: string; slug: string } | null;
}

export interface DashboardSummary {
  childrenCount: number;
  activeGroupsCount: number;
  employeesCount: number;
  monthRevenue: number;
  previousMonthRevenue: number;
  outstandingDebt: number;
  overdueInvoicesCount: number;
  todayAttendance: { present: number; absent: number };
  todayStaffAttendance: { present: number; absent: number };
  todayDailyReportsFilled: number;
  activeLeadsCount: number;
  pendingNotificationsCount: number;
  attention: {
    unmarkedAttendance: { childId: string; fullName: string; groupName: string | null }[];
    missingDailyReport: { childId: string; fullName: string; groupName: string | null }[];
    overdueVaccinations: { childId: string; fullName: string; vaccineName: string; scheduledDate: string }[];
  };
  upcomingBirthdays: { childId: string; fullName: string; birthDate: string; daysUntil: number }[];
  groupCapacity: {
    totalCapacity: number;
    totalActive: number;
    groups: { id: string; name: string; capacity: number; active: number; percent: number }[];
  };
  topDebtors: { childId: string; fullName: string; balance: number }[];
}

/** `GET /app/health/allergies` javobi — Ovqatlanish sahifasidagi ogohlantirish uchun. */
export interface ChildAllergy {
  allergies: string;
  child: { id: string; fullName: string; group?: { name: string } | null };
}

export interface AuditLogEntry {
  id: string;
  organizationId: string;
  branchId: string | null;
  actorUserId: string | null;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
  /** Tarmoq bo'yicha ro'yxatda — amal qaysi filialda bo'lgani */
  branch?: { name: string } | null;
}

/** Audit filtri uchun: amal bajargan kishi va nechta amal qilgani */
export interface AuditActor {
  actorUserId: string | null;
  actorName: string;
  count: number;
}

export interface Dish {
  id: string;
  organizationId: string;
  name: string;
  calories: number | null;
  allergens: string | null;
  createdAt: string;
}

export interface MenuEntry {
  id: string;
  branchId: string;
  date: string;
  breakfast: string | null;
  lunch: string | null;
  snack: string | null;
}

/** Oshpaz suratga olib yuklagan taom — qaysi ovqatga tegishli */
export type MenuMeal = "BREAKFAST" | "LUNCH" | "SNACK";

export interface MenuPhoto {
  id: string;
  meal: MenuMeal;
  createdAt: string;
}

export type StaffAttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "SICK" | "ON_LEAVE";

export interface StaffAttendanceEmployee {
  employeeId: string;
  fullName: string;
  position: string;
  status: StaffAttendanceStatus | null;
  note: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
}

export interface StaffAttendanceDay {
  date: string;
  /** Filial admini davomatni saqlab qulflagach true bo'ladi — o'sha kun endi o'zgartirilmaydi. */
  locked: boolean;
  lockedAt: string | null;
  lockedByName: string | null;
  employees: StaffAttendanceEmployee[];
}

/** `GET /app/staff-attendance/summary` javobi — oylik jamlanma. */
export interface StaffAttendanceSummary {
  period: string;
  totals: { present: number; absent: number; late: number; sick: number; onLeave: number };
  employees: {
    employeeId: string;
    fullName: string;
    position: string;
    subjects: string[];
    groups: string[];
    present: number;
    absent: number;
    late: number;
    sick: number;
    onLeave: number;
    rate: number | null;
  }[];
}

/** `GET /app/staff-attendance/history` javobi — bitta xodimning bir oylik kun-kun tarixi. */
export interface StaffAttendanceHistory {
  employee: {
    id: string;
    fullName: string;
    position: string;
    subjects: string[];
    groups: string[];
  };
  period: string;
  days: {
    date: string;
    status: StaffAttendanceStatus;
    checkInTime: string | null;
    checkOutTime: string | null;
    note: string | null;
  }[];
}

export type EatingQuality = "GOOD" | "AVERAGE" | "POOR";
export type MoodStatus = "HAPPY" | "NEUTRAL" | "UPSET";

export interface DailyReport {
  id: string;
  childId: string;
  date: string;
  eatingQuality: EatingQuality | null;
  sleepMinutes: number | null;
  mood: MoodStatus | null;
  toiletNotes: string | null;
  activityNotes: string | null;
  createdAt: string;
}

export interface DailyReportChild {
  childId: string;
  fullName: string;
  groupName: string | null;
  report: DailyReport | null;
}

export interface DailyReportDay {
  date: string;
  children: DailyReportChild[];
}

export type DevelopmentRating = "BELOW_EXPECTED" | "ON_TRACK" | "ABOVE_EXPECTED";

export interface DevelopmentAssessment {
  id: string;
  childId: string;
  period: string;
  speechRating: DevelopmentRating | null;
  motorRating: DevelopmentRating | null;
  socialRating: DevelopmentRating | null;
  cognitiveRating: DevelopmentRating | null;
  note: string | null;
  createdAt: string;
}

// ===== CRM / Navbat =====
export type AgeGroup = "AGE_1_2" | "AGE_2_3" | "AGE_3_4" | "AGE_4_5" | "AGE_5_6" | "AGE_6_7";
export type LeadSource = "WEBSITE" | "REFERRAL" | "SOCIAL_MEDIA" | "WALK_IN" | "OTHER";
export type LeadStage = "NEW" | "TRIAL_DAY_SCHEDULED" | "CONTRACT" | "WON" | "LOST";
export type LeadActivityType = "CALL" | "MESSAGE" | "MEETING" | "TRIAL_DAY" | "STAGE_CHANGE" | "NOTE";

export interface Lead {
  id: string;
  organizationId: string;
  branchId: string;
  childFullName: string;
  childBirthDate: string | null;
  ageGroup: AgeGroup | null;
  parentName: string;
  parentPhone: string;
  source: LeadSource;
  stage: LeadStage;
  lostReason: string | null;
  assignedToUserId: string | null;
  convertedChildId: string | null;
  followUpDate: string | null;
  trialDate: string | null;
  contractDate: string | null;
  contractNote: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: { id: string; fullName: string } | null;
}

export interface LeadActivity {
  id: string;
  leadId: string;
  type: LeadActivityType;
  note: string | null;
  createdByUserId: string | null;
  createdAt: string;
}

export interface LeadStats {
  totalActive: number;
  byStage: Record<LeadStage, number>;
  bySource: Record<LeadSource, number>;
}

// ===== Sog'liq / Tibbiyot =====
export type BloodType =
  | "A_POSITIVE"
  | "A_NEGATIVE"
  | "B_POSITIVE"
  | "B_NEGATIVE"
  | "AB_POSITIVE"
  | "AB_NEGATIVE"
  | "O_POSITIVE"
  | "O_NEGATIVE";
export type VaccinationStatus = "SCHEDULED" | "DONE" | "MISSED";

export interface HealthProfile {
  id: string;
  childId: string;
  bloodType: BloodType | null;
  chronicConditions: string | null;
  allergies: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Vaccination {
  id: string;
  childId: string;
  name: string;
  scheduledDate: string;
  doneDate: string | null;
  status: VaccinationStatus;
  note: string | null;
  createdAt: string;
}

export interface MedicationLog {
  id: string;
  childId: string;
  medicationName: string;
  dose: string;
  givenAt: string;
  givenByUserId: string | null;
  parentAuthorized: boolean;
  note: string | null;
  createdAt: string;
}

// ===== Ota-ona / Guardian =====
export type GuardianRelation = "FATHER" | "MOTHER" | "GRANDPARENT" | "OTHER";

export interface Guardian {
  id: string;
  organizationId: string;
  fullName: string;
  phone: string;
  createdAt: string;
}

export interface GuardianCabinetCredentials {
  guardianId: string;
  fullName: string;
  /** Login — telefon raqami. */
  login: string;
  /** Parol faqat shu javobda keladi: bazada xesh saqlanadi. */
  password: string;
}

export interface ChildGuardian {
  id: string;
  childId: string;
  guardianId: string;
  relation: GuardianRelation;
  isPrimary: boolean;
  canPickup: boolean;
  canViewFinance: boolean;
  canReceiveNotifications: boolean;
  createdAt: string;
  guardian: Guardian & {
    isActive?: boolean;
    lastLoginAt?: string | null;
    /** Kabinet ochilganmi — paroli bormi degani. */
    hasCabinet?: boolean;
  };
}

// ===== HR / Payroll =====
export type SalaryRuleType = "FIXED" | "PER_HOUR" | "PER_CHILD";
export type PayrollStatus = "DRAFT" | "PAID";

export interface SalaryScheme {
  id: string;
  employeeId: string;
  ruleType: SalaryRuleType;
  fixedAmount: string;
  rate: string;
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  employeeId: string;
  branchId: string;
  date: string;
  hours: string;
  note: string | null;
  createdAt: string;
}

export interface PayrollEntry {
  id: string;
  employeeId: string;
  branchId: string;
  period: string;
  baseAmount: string;
  bonusAmount: string;
  penaltyAmount: string;
  deductionAmount: string;
  totalAmount: string;
  /** Moliyachi qo'lda kiritgan haqiqiy to'langan summa — hisoblangan totalAmount'dan farqli bo'lishi mumkin. */
  paidAmount: string;
  status: PayrollStatus;
  paidAt: string | null;
  note: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: { id: string; fullName: string; position: string };
  branch?: { id: string; name: string };
}

/** `GET /app/employees/:id/payroll` javobi — xodim kartochkasidagi "Moliya" ko'rinishi uchun. */
export interface EmployeePayrollOverview {
  scheme: SalaryScheme | null;
  /** Shu davr uchun allaqachon hisoblangan/to'langan yozuv — bo'lmasa `null`. */
  entry: PayrollEntry | null;
  /** Yozuv hali yo'q bo'lsa, sxemadan jonli hisoblangan taxmin (hech narsa saqlanmagan). */
  preview: { baseAmount: number; totalAmount: number } | null;
}

// ===== Bildirishnomalar =====
export type NotificationEventType =
  | "CHILD_ABSENT"
  | "DAILY_REPORT_READY"
  | "PAYMENT_DUE"
  | "PAYMENT_OVERDUE"
  | "VACCINATION_DUE"
  | "QUARANTINE_ALERT"
  | "LEAD_FOLLOW_UP"
  | "CUSTOM";
export type NotificationChannel = "SMS" | "TELEGRAM" | "EMAIL" | "PHONE_CALL" | "IN_APP";
export type NotificationStatus = "PENDING" | "SENT";

export interface NotificationLog {
  id: string;
  organizationId: string;
  branchId: string;
  childId: string | null;
  eventType: NotificationEventType;
  channel: NotificationChannel | null;
  recipientName: string;
  recipientContact: string | null;
  message: string;
  status: NotificationStatus;
  sentByUserId: string | null;
  sentAt: string | null;
  createdAt: string;
  child?: { id: string; fullName: string } | null;
}

/** Super Adminning filial hisoboti (`/app/dashboard/branch-report`). */
export interface BranchReport {
  branch: {
    id: string;
    name: string;
    slug: string;
    address: string | null;
    timezone: string;
    currency: string;
    createdAt: string;
  };
  children: {
    active: number;
    boys: number;
    girls: number;
    /** Migratsiyadan oldin qo'shilgan bolalarda jins ko'rsatilmagan. */
    unknownGender: number;
    quarantined: number;
    inactive: number;
  };
  groups: {
    total: number;
    active: number;
    capacity: number;
    items: {
      id: string;
      name: string;
      capacity: number;
      status: GroupStatus;
      childrenCount: number;
      teachers: string[];
    }[];
  };
  employees: {
    total: number;
    active: number;
    withAccount: number;
    byPosition: { position: string; count: number }[];
  };
  finance: {
    monthRevenue: number;
    outstandingDebt: number;
    invoices: { status: InvoiceStatus; count: number; billed: number; paid: number }[];
  };
}

/* ------------------------------------------------------------------ */
/* Tarmoq bo'ylab moliya (Super Admin)                                 */
/* ------------------------------------------------------------------ */

interface MoneyBucket {
  billed: number;
  collected: number;
  outstanding: number;
}

/** `GET /app/finance/summary` javobi. Summalar — son, satr emas. */
export interface FinanceSummary {
  period: string;
  totals: MoneyBucket & { collectedInPeriod: number; invoiceCount: number };
  branches: (MoneyBucket & { branchId: string; branchName: string })[];
  groups: (MoneyBucket & {
    groupId: string | null;
    groupName: string;
    branchId: string | null;
    branchName: string;
  })[];
  statuses: { status: InvoiceStatus; count: number; billed: number; paid: number }[];
  byMethod: Record<PaymentMethod, { amount: number; count: number }>;
  weeklyPayments: { week: number; label: string; amount: number; count: number }[];
}

export type FinanceChildStatus = "PAID" | "PARTIAL" | "UNPAID";

/** `GET /app/finance/children` javobi. */
export interface FinanceChildren {
  period: string;
  counts: { total: number; paid: number; partial: number; unpaid: number };
  items: {
    childId: string;
    publicId: number;
    fullName: string;
    groupId: string | null;
    groupName: string | null;
    branchId: string;
    branchName: string;
    billed: number;
    paid: number;
    outstanding: number;
    status: FinanceChildStatus;
    dueDate: string | null;
    overdue: boolean;
  }[];
}

/** `GET /app/payroll/summary` javobi. */
export interface PayrollSummary {
  period: string | null;
  totals: {
    entries: number;
    base: number;
    bonus: number;
    penalty: number;
    deduction: number;
    total: number;
    paid: number;
    unpaid: number;
  };
  branches: { branchId: string; branchName: string; entries: number; total: number; paid: number; unpaid: number }[];
}

/** `GET /app/groups/:id/attendance/day` javobi. */
export interface GroupAttendanceDay {
  date: string;
  total: number;
  counts: { present: number; absent: number; unmarked: number };
  items: {
    childId: string;
    publicId: number;
    fullName: string;
    gender: Gender | null;
    status: AttendanceStatus | null;
    note: string | null;
  }[];
}

/* ------------------------------------------------------------------ */
/* Ota-ona kabineti                                                    */
/* ------------------------------------------------------------------ */

export interface ParentAccount {
  id: string;
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  fullName: string;
  phone: string;
}

export interface ParentChild {
  id: string;
  publicId: number;
  fullName: string;
  gender: Gender | null;
  birthDate: string | null;
  status: ChildStatus;
  avatarUpdatedAt: string | null;
  group: { id: string; name: string } | null;
  /** Manzil osmon holatini (quyosh botishi) hisoblash uchun kerak — qarang: lib/sky.ts */
  branch: { id: string; name: string; address?: string | null };
  relation: GuardianRelation;
}

/** `GET /app/parent/children/:id/day` javobi. */
export interface ParentDay {
  date: string;
  child: { id: string; fullName: string; groupName: string | null; avatarUpdatedAt: string | null };
  attendance: {
    status: AttendanceStatus;
    note: string | null;
    parentReason: string | null;
    /** Yuz tanish terminali yozgan kelish/ketish vaqti ("HH:MM") */
    checkInTime: string | null;
    checkOutTime: string | null;
  } | null;
  report: {
    eatingQuality: "GOOD" | "AVERAGE" | "POOR" | null;
    sleepMinutes: number | null;
    mood: "HAPPY" | "NEUTRAL" | "UPSET" | null;
    toiletNotes: string | null;
    activityNotes: string | null;
    updatedAt: string;
  } | null;
  menu: { breakfast: string | null; lunch: string | null; snack: string | null } | null;
  /** Oshpaz yuklagan taom suratlari (surat alohida so'raladi) */
  menuPhotos: { id: string; meal: MenuMeal }[];
}

export interface ParentAttendanceStrip {
  items: { date: string; status: AttendanceStatus | null }[];
  present: number;
  absent: number;
  marked: number;
}

/** `GET /app/parent/children/:id/payment-reminder` javobi — to'lov eslatma kartasi. */
export interface ParentPaymentReminder {
  visible: boolean;
  message?: string;
  amount?: string;
  dueDate?: string;
  daysUntilDue?: number;
  overdue?: boolean;
}

/** `GET/POST /app/parent/children/:id/payment-receipts` — ota-ona yuklagan to'lov cheklari. */
export interface ParentPaymentReceipt {
  id: string;
  claimedAmount: string;
  currency: string;
  status: PaymentReceiptStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

/** `GET /app/parent/children/:id/products` javobi — coin do'koni. */
export interface ParentShop {
  balance: number;
  products: Product[];
}

/** `POST /app/parent/children/:id/products/:productId/purchase` javobi. */
export interface ParentPurchaseResult {
  product: Product;
  balance: number;
}

/* ------------------------------------------------------------------ */
/* Qo'shimcha darsliklar — dars jadvali, savol-javob, baholar          */
/* ------------------------------------------------------------------ */

export type Weekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export interface LessonSchedule {
  id: string;
  branchId: string;
  groupId: string;
  employeeId: string;
  subject: string | null;
  weekday: Weekday;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
  group: { id: string; name: string };
  employee: { id: string; fullName: string };
}

export interface EmployeeNotification {
  id: string;
  branchId: string;
  employeeId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export interface TopicQuestion {
  id: string;
  topicId: string;
  question: string;
  options: string[];
  answer: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /app/lesson-topics` ro'yxatidagi bitta element. */
export interface LessonTopic {
  id: string;
  branchId: string;
  groupId: string;
  employeeId: string;
  subject: string | null;
  title: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  _count: { questions: number };
  /** Mavzu sanasi 2+ oy oldin bo'lsa — takrorlash vaqti kelgani. */
  reviewDue: boolean;
}

/** Ota-ona uchun savol — variantsiz, uyda farzandidan so'rash uchun. */
export interface ParentQuestion {
  id: string;
  topicId: string;
  question: string;
  createdAt: string;
  updatedAt: string;
}

/** `GET /app/lesson-topics/:id` javobi — savollar banki bilan birga. */
export interface LessonTopicDetail {
  id: string;
  branchId: string;
  groupId: string;
  employeeId: string;
  subject: string | null;
  title: string;
  date: string;
  createdAt: string;
  updatedAt: string;
  reviewDue: boolean;
  questions: TopicQuestion[];
}

/**
 * Xodim tafsilot oynasidagi "Mavzu qo'shasizmi?" ro'yxatidagi bitta element.
 * `GET/POST /app/employees/:id/topics`.
 */
export interface EmployeeTopic {
  id: string;
  employeeId: string;
  title: string;
  createdAt: string;
}

export interface LessonGrade {
  id: string;
  branchId: string;
  groupId: string;
  childId: string;
  employeeId: string;
  topicId: string | null;
  date: string;
  score: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET /app/lesson-grades?groupId=&date=` javobidagi bitta bola. */
export interface LessonGradeChild {
  childId: string;
  fullName: string;
  grade: LessonGrade | null;
}

export interface LessonGradeDay {
  groupId: string;
  date: string;
  children: LessonGradeChild[];
}

/* ------------------------------------------------------------------ */
/* Foydali — she'rlar, maqollar, ertaklar                              */
/* ------------------------------------------------------------------ */

export type UsefulStatus = "DRAFT" | "PUBLISHED";

interface UsefulCreatedBy {
  id: string;
  fullName: string;
}

interface UsefulGroupRef {
  id: string;
  name: string;
}

/** `GET/POST/PATCH /app/useful/poems` — tarbiyachi tomoni. */
export interface Poem {
  id: string;
  branchId: string;
  /** null — butun filial uchun. */
  groupId: string | null;
  title: string;
  author: string | null;
  ageFrom: number;
  ageTo: number;
  /** Bandlar: har biri qatorlar massivi. */
  stanzas: string[][];
  status: UsefulStatus;
  createdById: string;
  createdBy: UsefulCreatedBy;
  group: UsefulGroupRef | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET/POST/PATCH /app/useful/proverbs` — tarbiyachi tomoni. */
export interface Proverb {
  id: string;
  branchId: string;
  groupId: string | null;
  text: string;
  meaning: string;
  status: UsefulStatus;
  createdById: string;
  createdBy: UsefulCreatedBy;
  group: UsefulGroupRef | null;
  createdAt: string;
  updatedAt: string;
}

/** `GET/POST/PATCH /app/useful/tales` — tarbiyachi tomoni. */
export interface Tale {
  id: string;
  branchId: string;
  groupId: string | null;
  title: string;
  origin: string;
  minutes: number;
  paragraphs: string[];
  moral: string;
  questions: string[];
  cover: string;
  ageFrom: number;
  ageTo: number;
  status: UsefulStatus;
  createdById: string;
  createdBy: UsefulCreatedBy;
  group: UsefulGroupRef | null;
  createdAt: string;
  updatedAt: string;
}

// --- Lending sahifa (landing-web) ---------------------------------------------
// `GET /app/landing/...` orqali o'qiladi (ochiq), `POST/PATCH/DELETE` esa shu
// yerdan — "Lending sahifa" bo'limi orqali kiritiladi. Kontent global: barcha
// tashkilotlar bitta umumiy landing-web saytini ko'radi.

export interface LandingTeacher {
  id: string;
  fullName: string;
  role: string;
  bio: string | null;
  experience: string | null;
  photoPath: string | null;
  order: number;
}

export type LandingMealType = "BREAKFAST" | "LUNCH" | "SNACK" | "DINNER" | "OTHER";

export type LandingWeekday = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export interface LandingMeal {
  id: string;
  title: string;
  description: string | null;
  mealType: LandingMealType;
  weekday: LandingWeekday | null;
  time: string | null;
  photoPath: string | null;
  order: number;
}

/** Guruh sahifasidagi (saytda) galereya rasmi — kartochkadagi `photoPath`dan alohida. */
export interface LandingGroupPhoto {
  id: string;
  path: string;
  order: number;
}

/** Guruh sahifasidagi "N-o'quvchi" joylaridan biriga kiritilgan haqiqiy o'quvchi. */
export interface LandingGroupStudent {
  id: string;
  name: string;
  bio: string | null;
  photoPath: string | null;
  order: number;
}

export interface LandingGroup {
  id: string;
  name: string;
  slug: string;
  /** Kartochkada (guruhlar ro'yxatida) ko'rinadigan rasm. */
  photoPath: string | null;
  /** Guruhning o'z sahifasidagi bosh (hero) rasmi — kartochkadagi rasmdan alohida. */
  coverPhotoPath: string | null;
  order: number;
  photos: LandingGroupPhoto[];
  students: LandingGroupStudent[];
}

/** "O'qituvchilar" sahifasidagi yumaloq rasmli maxsus bloklar ("maxsus-oqituvchi-1/2"). */
export interface LandingContentBlock {
  id: string;
  key: string;
  title: string;
  body: string;
  photoPath: string | null;
}
