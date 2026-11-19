import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma, type TenantUserRole } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../database/prisma.service";
import { normalizePhone } from "../../common/phone";
import { generateEmployeeLogin, generateEmployeePassword } from "../../common/text/generate-credentials";
import { DEFAULT_POSITIONS } from "../../common/constants/default-positions";
import {
  TenantAuthenticatedUser,
  TenantScope,
  requireOperationalScope,
  resolveReadBranchFilter,
  toTenantScope,
} from "../iam/tenant-auth.types";
import { verifyRevealToken } from "../webauthn/reveal-token";
import { AuditLogService } from "../audit-log/audit-log.service";
import { FaceIdService } from "../face-id/face-id.service";
import { FaceIdCommandsService } from "../face-id/face-id-commands.service";
import { R2Service } from "../storage/r2.service";
import { R2_CATEGORY } from "../storage/r2.constants";
import { CreateEmployeeDto, EmployeeAccountDto } from "./dto/create-employee.dto";
import { UpdateEmployeeCredentialsDto } from "./dto/update-employee-credentials.dto";
import { UpdateEmployeeDto } from "./dto/update-employee.dto";
import { CreateEmployeeTopicDto } from "./dto/create-employee-topic.dto";
import { UpdateEmployeeTopicsSettingDto } from "./dto/update-employee-topics-setting.dto";
import { UpdateEmployeeGroupsDto } from "./dto/update-employee-groups.dto";
import { UpdateEmployeeAvatarDto } from "./dto/update-employee-avatar.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";
import { allOn } from "../../common/features/feature-access";

/** 512px JPEG shu hajmdan oshmasligi kerak. */
const MAX_EMPLOYEE_AVATAR_BYTES = 600 * 1024;

/** Ro'yxatlarda ko'rinadigan yagona nom — bolalardagi kabi "Familiya Ism" tartibida. */
function composeEmployeeFullName(lastName: string, firstName: string): string {
  return `${lastName.trim()} ${firstName.trim()}`.trim();
}

/** Turli tirnoq belgilari bilan kiritilgan lavozim nomini solishtirish uchun. */
function normalizePosition(value: string): string {
  return value.trim().toLowerCase().replace(/[‘’`]/g, "'");
}

const SUBJECT_TEACHER_POSITION = normalizePosition(DEFAULT_POSITIONS[0]);

// Tizimga kirmaydigan lavozimlar: ro'yxatda turadi, lekin login/parol berilmaydi.
// Kassir ham shu yerda: moliyaga kirish alohida moliyachi hisobi bilan ochiladi —
// xodim formasidan emas (aks holda call operator kassir parolini ko'rib qolardi).
const CABINETLESS_POSITIONS = new Set(["oshpaz yordamchisi", "idish yuvuchi", "idish yuvuvchi", "kassir"]);
// Administrator roli bilan kiradigan lavozimlar. Eski bog'chalar katalogida
// "Administrator" va "Operator" turibdi, yangilarida "Call Operator".
const MANAGER_POSITIONS = new Set(["call operator", "operator", "administrator"]);
// Kabineti bor, lekin guruhi yo'q lavozimlar.
const GROUPLESS_POSITIONS = new Set(["bosh oshpaz", ...MANAGER_POSITIONS]);
const GROUP_REQUIRED_MESSAGE = "Kamida bitta guruh tanlang";

// Call Operator / Operator / Administrator MANAGER roli bilan kiradi: qarzdorlarga eslatma
// va filial ishlarini yuritadi (operatorlar @DenyCallOperator yo'llariga kirmaydi).
// Bosh oshpaz CHEF roli bilan kiradi: faqat oshxona (menyu, porsiyalar, taom suratlari).
function roleForPosition(position: string): "MANAGER" | "TEACHER" | "CHEF" {
  const normalized = normalizePosition(position);
  if (MANAGER_POSITIONS.has(normalized)) return "MANAGER";
  if (normalized === "bosh oshpaz") return "CHEF";
  return "TEACHER";
}

function requireGroupsFor(position: string, groupIds: string[] | undefined): string[] {
  const ids = groupIds ?? [];
  if (ids.length === 0 && !GROUPLESS_POSITIONS.has(normalizePosition(position))) {
    throw new BadRequestException(GROUP_REQUIRED_MESSAGE);
  }
  return ids;
}

const CABINETLESS_MESSAGE = "Bu lavozimdagi xodimga kabinet (login/parol) ochilmaydi";

/** Ro'yxatda kabinet holati va biriktirilgan guruhlar ham ko'rinadi. */
const employeeInclude = {
  tenantUser: { select: { id: true, login: true, role: true, isActive: true } },
  teachingGroups: { include: { group: { select: { id: true, name: true } } } },
  // Oylik sxemasi ro'yxat bilan birga keladi: aks holda tarmoq bo'ylab
  // oyliklarni ko'rsatish uchun har bir xodimga alohida so'rov ketardi.
  salaryScheme: { select: { ruleType: true, fixedAmount: true, rate: true } },
} satisfies Prisma.EmployeeInclude;

/**
 * Xodim kabinetining login/parolini kim boshqara oladi (yangilash, o'zgartirish,
 * ko'rsatish). Call operator (MANAGER) faqat o'qituvchi va oshpazni; filial admini
 * ularga qo'shimcha call operatorni ham. Moliyachi va adminlar hisobi bu yerdan
 * boshqarilmaydi — aks holda call operator kassir parolini olib, uning nomidan
 * pul amallarini bajara olardi (tenant-users dagi qoida bilan bir xil ruh).
 */
function assertCanManageCredentials(callerRole: TenantUserRole, targetRole: TenantUserRole | null | undefined) {
  const allowed: Partial<Record<TenantUserRole, TenantUserRole[]>> = {
    BRANCH_ADMIN: ["TEACHER", "CHEF", "MANAGER"],
    MANAGER: ["TEACHER", "CHEF"],
  };
  if (!targetRole || !(allowed[callerRole] ?? []).includes(targetRole)) {
    throw new ForbiddenException("Bu xodimning login/parolini boshqarishga huquqingiz yo'q");
  }
}

/** Administrator (MANAGER) faqat o'qituvchi va oshpazni tahrirlaydi/arxivlaydi. */
function assertCanEditEmployee(callerRole: TenantUserRole, targetRole: TenantUserRole | null) {
  if (callerRole === "MANAGER" && targetRole && !["TEACHER", "CHEF"].includes(targetRole)) {
    throw new ForbiddenException("Bu xodimni tahrirlashga huquqingiz yo'q");
  }
}

/** O'qituvchi va oshpaz xodimlar ro'yxatida hamkasblarining oyligi va loginini ko'rmaydi. */
const ROLES_WITHOUT_STAFF_DETAILS: TenantUserRole[] = ["TEACHER", "CHEF"];

/**
 * Javobdagi xodimdan chaqiruvchi ko'rmasligi kerak bo'lgan qismlar olib
 * tashlanadi (shakl o'zgarmaydi): oylik — HR o'chiq bo'lsa null, login —
 * "Kirish akkaunti" o'chiq bo'lsa "". O'qituvchi/oshpaz ikkalasini ham ko'rmaydi.
 */
function redactEmployee<T extends { salaryScheme: unknown; tenantUser: { login: string } | null }>(
  row: T,
  role: TenantUserRole,
  disabled: readonly string[],
): T {
  const limitedRole = ROLES_WITHOUT_STAFF_DETAILS.includes(role);
  const hideSalary = limitedRole || !allOn(disabled, "hr");
  const hideLogin = limitedRole || !allOn(disabled, "employeeAccount");
  if (!hideSalary && !hideLogin) return row;
  return {
    ...row,
    salaryScheme: hideSalary ? null : row.salaryScheme,
    tenantUser: row.tenantUser && hideLogin ? { ...row.tenantUser, login: "" } : row.tenantUser,
  };
}

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditLog: AuditLogService,
    private readonly faceIdService: FaceIdService,
    private readonly faceIdCommands: FaceIdCommandsService,
    private readonly r2: R2Service,
  ) {}

  async create(caller: TenantAuthenticatedUser, dto: CreateEmployeeDto) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const fullName = composeEmployeeFullName(dto.lastName, dto.firstName);
    const phone = dto.phone ? normalizePhone(dto.phone) : null;
    if (phone) {
      const existingByPhone = await this.prisma.employee.findFirst({
        where: { organizationId: scope.organizationId, phone },
        select: { id: true },
      });
      if (existingByPhone) {
        throw new ConflictException("Bu telefon raqami boshqa xodimda allaqachon mavjud");
      }
    }
    const isSubjectTeacher = normalizePosition(dto.position) === SUBJECT_TEACHER_POSITION;
    if (isSubjectTeacher && (!dto.subjects || dto.subjects.length === 0)) {
      throw new BadRequestException("Kamida bitta fan tanlang");
    }
    const subjects = isSubjectTeacher ? dto.subjects! : [];

    if (dto.account && CABINETLESS_POSITIONS.has(normalizePosition(dto.position))) {
      throw new BadRequestException(CABINETLESS_MESSAGE);
    }

    if (!dto.account) {
      const employee = await this.prisma.employee.create({
        data: {
          organizationId: scope.organizationId,
          branchId,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          fullName,
          phone,
          position: dto.position,
          subjects,
        },
        include: employeeInclude,
      });
      await this.auditLog.logFromUser(caller, {
        action: "employee.create",
        entityType: "Employee",
        entityId: employee.id,
        branchId,
        summary: `${fullName} xodim sifatida qo'shildi (${dto.position})`,
      });
      await this.faceIdService.autoEnrollNewPerson(
        { organizationId: scope.organizationId, branchId },
        { personType: "EMPLOYEE", employeeId: employee.id },
      );
      // Filialdagi yuz tanish terminallariga xodimni qo'shish buyrug'i (agent bajaradi)
      await this.faceIdCommands.enqueueEmployeeSync(employee.id);
      return { employee: redactEmployee(employee, scope.role, caller.disabledFeatures), credentials: null };
    }

    const accountGroupIds = requireGroupsFor(dto.position, dto.account.groupIds);
    await this.assertGroupsBelongToBranch(branchId, accountGroupIds);
    const { login, password, passwordHash } = await this.resolveCredentials(
      scope.organizationId,
      dto.firstName,
      dto.lastName,
      dto.account.login,
      dto.account.password,
    );

    // Xodim, uning logini va guruh biriktiruvi bitta tranzaksiyada — yarim
    // yaratilgan kabinet (login bor, guruhi yo'q) qolib ketmasligi kerak.
    try {
      const employee = await this.prisma.$transaction(async (tx) => {
        const tenantUser = await tx.tenantUser.create({
          data: {
            organizationId: scope.organizationId,
            branchId,
            login,
            passwordHash,
            fullName,
            role: roleForPosition(dto.position),
          },
        });
        return tx.employee.create({
          data: {
            organizationId: scope.organizationId,
            branchId,
            firstName: dto.firstName.trim(),
            lastName: dto.lastName.trim(),
            fullName,
            phone,
            position: dto.position,
            subjects,
            tenantUserId: tenantUser.id,
            teachingGroups: { create: accountGroupIds.map((groupId) => ({ groupId })) },
          },
          include: employeeInclude,
        });
      });
      await this.auditLog.logFromUser(caller, {
        action: "employee.create",
        entityType: "Employee",
        entityId: employee.id,
        branchId,
        summary: `${fullName} xodim sifatida qo'shildi va kabinet ochildi (${login})`,
      });
      await this.faceIdService.autoEnrollNewPerson(
        { organizationId: scope.organizationId, branchId },
        { personType: "EMPLOYEE", employeeId: employee.id },
      );
      // Filialdagi yuz tanish terminallariga xodimni qo'shish buyrug'i (agent bajaradi)
      await this.faceIdCommands.enqueueEmployeeSync(employee.id);
      return { employee: redactEmployee(employee, scope.role, caller.disabledFeatures), credentials: { login, password } };
    } catch (err) {
      throw this.translateLoginConflict(err);
    }
  }

  /**
   * Login va parolni admin bergan bo'lsa shuni ishlatadi, aks holda
   * login (`ism.familiya`) va tasodifiy parol avtomatik generatsiya
   * qiladi. Parol faqat argon2 hash sifatida saqlanadi — qaytarib
   * ochiladigan nusxasi yo'q, tizimda hech kim uni ko'ra olmaydi. Yangi
   * parol faqat yaratilgan javobda bir marta qaytadi.
   */
  private async resolveCredentials(
    organizationId: string,
    firstName: string,
    lastName: string,
    customLogin?: string,
    customPassword?: string,
  ) {
    const login = customLogin
      ? customLogin.trim().toLowerCase()
      : await generateEmployeeLogin(firstName, lastName, async (candidate) => {
          const existing = await this.prisma.tenantUser.findUnique({
            where: { organizationId_login: { organizationId, login: candidate } },
            select: { id: true },
          });
          return !!existing;
        });
    const password = customPassword ?? generateEmployeePassword();
    const passwordHash = await argon2.hash(password);
    return { login, password, passwordHash };
  }

  async findAll(scope: TenantScope, query: EmployeeQueryDto, disabled: readonly string[] = []) {
    const where: Prisma.EmployeeWhereInput = {
      organizationId: scope.organizationId,
      branchId: resolveReadBranchFilter(scope, query.branchId),
      // Arxivdagi xodim odatda ko'rinmaydi (ro'yxat, guruhga biriktirish, smena tanlovlari)
      ...(query.archived === "all" ? {} : { isActive: query.archived !== "only" }),
      ...(query.isActive !== undefined ? { isActive: query.isActive } : {}),
    };
    const rows = await this.prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: query.archived === "only" ? [{ archivedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }] : { createdAt: "desc" },
    });
    return rows.map((row) => redactEmployee(row, scope.role, disabled));
  }

  /** Tarbiyachining guruhlarini almashtiradi (qo'shish/olib tashlash bitta amalda). */
  async updateGroups(scope: TenantScope, employeeId: string, dto: UpdateEmployeeGroupsDto, disabled: readonly string[] = []) {
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: scope.organizationId, branchId },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    await this.assertGroupsBelongToBranch(branchId, dto.groupIds);

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.groupTeacher.deleteMany({ where: { employeeId } });
      if (dto.groupIds.length > 0) {
        await tx.groupTeacher.createMany({
          data: dto.groupIds.map((groupId) => ({ groupId, employeeId })),
        });
      }
      return tx.employee.findUniqueOrThrow({ where: { id: employeeId }, include: employeeInclude });
    });
    return redactEmployee(updated, scope.role, disabled);
  }

  /**
   * Xodimni tahrirlash: ism, telefon, lavozim (fan) va kabineti bo'lsa —
   * guruhi. Kabinet (TenantUser) xodim bilan birga moslanadi: ism o'zgarsa
   * kabinetdagi ism ham, lavozim o'zgarsa rol ham (o'qituvchi/oshpaz/
   * administrator). Yuz tanish terminali ham yangilanadi. Ishdan ketish bu
   * yerda emas — `archive` / `restore` (avvalgi «Faol/Nofaol» o'rniga).
   *
   * Huquq: administrator (MANAGER) faqat o'qituvchi va oshpazni tahrirlaydi
   * va hech kimni administrator qila olmaydi — login/parol qoidasi bilan bir xil.
   * Filial admini yoki moliyachi kabinetiga bog'langan xodimning roli
   * lavozimdan qayta hisoblanmaydi (adminni o'qituvchiga tushirib qo'ymaslik uchun).
   */
  async update(caller: TenantAuthenticatedUser, id: string, dto: UpdateEmployeeDto) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      include: { tenantUser: { select: { id: true, role: true } }, teachingGroups: { select: { groupId: true } } },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    const currentRole = employee.tenantUser?.role ?? null;
    assertCanEditEmployee(scope.role, currentRole);

    const firstName = dto.firstName?.trim() ?? employee.firstName;
    const lastName = dto.lastName?.trim() ?? employee.lastName;
    const fullName = composeEmployeeFullName(lastName, firstName);
    const position = dto.position?.trim() ?? employee.position;
    const positionChanged = normalizePosition(position) !== normalizePosition(employee.position);

    let phone = employee.phone;
    if (dto.phone !== undefined) {
      phone = dto.phone.trim() ? normalizePhone(dto.phone) : null;
      if (phone && phone !== employee.phone) {
        const taken = await this.prisma.employee.findFirst({
          where: { organizationId: scope.organizationId, phone, id: { not: id } },
          select: { id: true },
        });
        if (taken) {
          throw new ConflictException("Bu telefon raqami boshqa xodimda allaqachon mavjud");
        }
      }
    }

    const isSubjectTeacher = normalizePosition(position) === SUBJECT_TEACHER_POSITION;
    const subjects = isSubjectTeacher ? (dto.subjects ?? employee.subjects).map((s) => s.trim()).filter(Boolean) : [];
    if (isSubjectTeacher && subjects.length === 0) {
      throw new BadRequestException("Kamida bitta fan tanlang");
    }

    if (employee.tenantUser && positionChanged && CABINETLESS_POSITIONS.has(normalizePosition(position))) {
      throw new BadRequestException("Kabineti bor xodimni kabinetsiz lavozimga o'tkazib bo'lmaydi");
    }

    // Kabinet roli lavozimdan kelib chiqadigan bo'lsagina qayta hisoblanadi
    const derivedRoles: TenantUserRole[] = ["TEACHER", "CHEF", "MANAGER"];
    const nextRole = currentRole && derivedRoles.includes(currentRole) ? roleForPosition(position) : currentRole;
    if (nextRole && nextRole !== currentRole && scope.role === "MANAGER" && nextRole === "MANAGER") {
      throw new ForbiddenException("Administrator lavozimiga faqat filial admini o'tkaza oladi");
    }

    // Guruh: faqat kabineti bor o'qituvchi/oshpaz/administratorda. Guruhsiz
    // lavozimga o'tsa guruhdan chiqariladi.
    let groupIds: string[] | null = null;
    if (employee.tenantUser && currentRole && derivedRoles.includes(currentRole)) {
      if (GROUPLESS_POSITIONS.has(normalizePosition(position))) {
        groupIds = employee.teachingGroups.length > 0 ? [] : null;
      } else if (dto.groupIds !== undefined) {
        groupIds = requireGroupsFor(position, dto.groupIds);
        await this.assertGroupsBelongToBranch(branchId, groupIds);
      } else if (positionChanged && employee.teachingGroups.length === 0) {
        throw new BadRequestException(GROUP_REQUIRED_MESSAGE);
      }
    }

    const nameChanged = fullName !== employee.fullName;

    const updated = await this.prisma.$transaction(async (tx) => {
      if (employee.tenantUser) {
        const userData: Prisma.TenantUserUpdateInput = {};
        if (nameChanged) userData.fullName = fullName;
        if (nextRole && nextRole !== currentRole) userData.role = nextRole;
        if (Object.keys(userData).length > 0) {
          await tx.tenantUser.update({ where: { id: employee.tenantUser.id }, data: userData });
        }
        // Roli o'zgarsa — eski seans eski huquq bilan qolmasin
        if (nextRole && nextRole !== currentRole) {
          await tx.tenantRefreshToken.updateMany({
            where: { tenantUserId: employee.tenantUser.id, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }
      if (groupIds !== null) {
        await tx.groupTeacher.deleteMany({ where: { employeeId: id } });
        if (groupIds.length > 0) {
          await tx.groupTeacher.createMany({ data: groupIds.map((groupId) => ({ groupId, employeeId: id })) });
        }
      }
      return tx.employee.update({
        where: { id },
        data: { firstName, lastName, fullName, phone, position, subjects },
        include: employeeInclude,
      });
    });

    const changes = [
      nameChanged && `ism: ${employee.fullName} → ${fullName}`,
      phone !== employee.phone && "telefon",
      positionChanged && `lavozim: ${employee.position} → ${position}`,
      groupIds !== null && "guruh",
    ].filter(Boolean);
    if (changes.length > 0) {
      await this.auditLog.logFromUser(caller, {
        action: "employee.update",
        entityType: "Employee",
        entityId: id,
        branchId,
        summary: `${fullName} tahrirlandi (${changes.join(", ")})`,
      });
    }

    // Yuz tanish terminallarida ism yangilanadi (arxivdagi xodim u yerda yo'q)
    if (employee.isActive && nameChanged) {
      await this.faceIdCommands.enqueueEmployeeSync(id);
    }
    return redactEmployee(updated, scope.role, caller.disabledFeatures);
  }

  /**
   * Ishdan ketgan xodimni arxivlaydi — o'chirilmaydi: davomat, oylik, smena
   * va dars tarixi saqlanadi. Arxivdagi xodim ro'yxatlardan, guruhdan va yuz
   * tanish terminalidan chiqadi, kabineti yopiladi va seanslari tugatiladi.
   */
  archive(caller: TenantAuthenticatedUser, id: string) {
    return this.setArchived(caller, id, true);
  }

  /**
   * Arxivdagi xodimni ishga qaytaradi: kabineti qayta ochiladi (login/parol
   * o'sha), yuz tanish terminaliga qayta yoziladi. Guruhga qaytadan biriktiriladi.
   */
  restore(caller: TenantAuthenticatedUser, id: string) {
    return this.setArchived(caller, id, false);
  }

  /** Arxivlash va qaytarishning umumiy yo'li (avvalgi «Faol/Nofaol» almashtirgichi o'rniga). */
  private async setArchived(caller: TenantAuthenticatedUser, id: string, archived: boolean) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: {
        id: true,
        fullName: true,
        isActive: true,
        tenantUserId: true,
        employeeNo: true,
        organizationId: true,
        tenantUser: { select: { role: true } },
      },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    assertCanEditEmployee(scope.role, employee.tenantUser?.role ?? null);
    if (archived && !employee.isActive) {
      throw new BadRequestException("Xodim allaqachon arxivda");
    }
    if (!archived && employee.isActive) {
      throw new BadRequestException("Xodim arxivda emas");
    }
    if (archived && employee.tenantUserId === scope.userId) {
      throw new BadRequestException("O'zingizni arxivlay olmaysiz");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (employee.tenantUserId) {
        await tx.tenantUser.update({ where: { id: employee.tenantUserId }, data: { isActive: !archived } });
        // Arxivlansa — ochiq seanslar darhol tugaydi
        if (archived) {
          await tx.tenantRefreshToken.updateMany({
            where: { tenantUserId: employee.tenantUserId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
      }
      // Guruhda arxivdagi tarbiyachi ko'rinmasin — qaytarilsa qayta biriktiriladi
      if (archived) {
        await tx.groupTeacher.deleteMany({ where: { employeeId: employee.id } });
      }
      return tx.employee.update({
        where: { id: employee.id },
        data: { isActive: !archived, archivedAt: archived ? new Date() : null },
        include: employeeInclude,
      });
    });

    await this.auditLog.logFromUser(caller, {
      action: archived ? "employee.archive" : "employee.restore",
      entityType: "Employee",
      entityId: employee.id,
      branchId,
      summary: archived ? `${employee.fullName} arxivga o'tkazildi` : `${employee.fullName} arxivdan qaytarildi`,
    });

    // Yuz tanish terminallari: arxivlansa — olib tashlanadi; qaytarilsa — qayta yoziladi (surati bilan)
    if (archived) {
      await this.faceIdCommands.enqueueDelete({ organizationId: employee.organizationId, branchId, employeeNo: employee.employeeNo });
    } else {
      await this.faceIdCommands.enqueueEmployeeSync(employee.id);
      await this.faceIdCommands.enqueueFace(employee.id);
    }
    return redactEmployee(updated, scope.role, caller.disabledFeatures);
  }

  /**
   * Xodim faoliyatining xulosasi — xodim sahifasida (ayniqsa arxivdagisida):
   * ishlagan davri, davomat bo'yicha kunlar, to'langan oyliklar.
   */
  async activitySummary(scope: TenantScope, id: string) {
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId: resolveReadBranchFilter(scope, undefined) },
      select: { id: true, createdAt: true, archivedAt: true },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    const [attendance, firstLast, payroll] = await Promise.all([
      this.prisma.employeeAttendance.groupBy({ by: ["status"], where: { employeeId: id }, _count: { _all: true } }),
      this.prisma.employeeAttendance.aggregate({ where: { employeeId: id }, _min: { date: true }, _max: { date: true } }),
      this.prisma.payrollEntry.aggregate({
        where: { employeeId: id, status: "PAID" },
        _sum: { paidAmount: true },
        _count: { _all: true },
        _max: { period: true },
      }),
    ]);
    const days = (status: string) => attendance.find((row) => row.status === status)?._count._all ?? 0;
    return {
      startedAt: employee.createdAt,
      archivedAt: employee.archivedAt,
      attendance: {
        present: days("PRESENT"),
        late: days("LATE"),
        absent: days("ABSENT"),
        sick: days("SICK"),
        onLeave: days("ON_LEAVE"),
        firstDate: firstLast._min.date,
        lastDate: firstLast._max.date,
      },
      payroll: {
        paidMonths: payroll._count._all,
        paidTotal: Number(payroll._sum.paidAmount ?? 0),
        lastPaidPeriod: payroll._max.period,
      },
    };
  }

  /** Kabineti bo'lmagan xodimga keyinchalik login ochish. Login/parol avtomatik generatsiya qilinadi. */
  async openAccount(caller: TenantAuthenticatedUser, employeeId: string, dto: EmployeeAccountDto) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: scope.organizationId, branchId },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    if (employee.tenantUserId) {
      throw new ConflictException("Bu xodimning kabineti allaqachon ochilgan");
    }
    if (CABINETLESS_POSITIONS.has(normalizePosition(employee.position))) {
      throw new BadRequestException(CABINETLESS_MESSAGE);
    }
    const groupIds = requireGroupsFor(employee.position, dto.groupIds);
    await this.assertGroupsBelongToBranch(branchId, groupIds);
    const { login, password, passwordHash } = await this.resolveCredentials(
      scope.organizationId,
      employee.firstName,
      employee.lastName,
      dto.login,
      dto.password,
    );

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const tenantUser = await tx.tenantUser.create({
          data: {
            organizationId: scope.organizationId,
            branchId,
            login,
            passwordHash,
            fullName: employee.fullName,
            role: roleForPosition(employee.position),
          },
        });
        await tx.groupTeacher.deleteMany({ where: { employeeId } });
        await tx.groupTeacher.createMany({
          data: groupIds.map((groupId) => ({ groupId, employeeId })),
        });
        return tx.employee.update({
          where: { id: employeeId },
          data: { tenantUserId: tenantUser.id },
          include: employeeInclude,
        });
      });
      await this.auditLog.logFromUser(caller, {
        action: "employee.account_open",
        entityType: "Employee",
        entityId: employeeId,
        branchId,
        summary: `${employee.fullName} uchun kabinet ochildi (${login})`,
      });
      return { employee: redactEmployee(updated, scope.role, caller.disabledFeatures), credentials: { login, password } };
    } catch (err) {
      throw this.translateLoginConflict(err);
    }
  }

  /**
   * Xodimga yangi parol generatsiya qiladi (bir martalik javobda qaytadi).
   * Bu yerda WebAuthn talab qilinmaydi — admin hozir shu sessiyada, o'zi
   * turib yangi parol yaratmoqda. Eski seanslar darhol yopiladi.
   */
  async regeneratePassword(caller: TenantAuthenticatedUser, id: string) {
    const scope = toTenantScope(caller);
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true, fullName: true, tenantUserId: true, tenantUser: { select: { role: true } } },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    if (!employee.tenantUserId) {
      throw new BadRequestException("Bu xodimning kabineti yo'q");
    }
    assertCanManageCredentials(scope.role, employee.tenantUser?.role);

    const password = generateEmployeePassword();
    const passwordHash = await argon2.hash(password);
    await this.prisma.tenantUser.update({
      where: { id: employee.tenantUserId },
      data: { passwordHash, passwordEncrypted: null },
    });
    await this.prisma.tenantRefreshToken.updateMany({
      where: { tenantUserId: employee.tenantUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.auditLog.logFromUser(caller, {
      action: "employee.password_regenerate",
      entityType: "Employee",
      entityId: id,
      branchId,
      summary: `${employee.fullName} uchun yangi parol generatsiya qilindi`,
    });
    return { password };
  }

  /**
   * Admin login va/yoki parolni o'zi kiritib o'zgartiradi (generatsiyasiz).
   * `regeneratePassword` kabi WebAuthn talab qilinmaydi. Parol o'zgarsa,
   * eski seanslar darhol yopiladi; faqat login o'zgarganda esa yo'q —
   * mavjud sessiyalar userId bo'yicha ishlayveradi.
   */
  async updateCredentials(scope: TenantScope, id: string, dto: UpdateEmployeeCredentialsDto) {
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { tenantUserId: true, tenantUser: { select: { role: true } } },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    if (!employee.tenantUserId) {
      throw new BadRequestException("Bu xodimning kabineti yo'q");
    }
    assertCanManageCredentials(scope.role, employee.tenantUser?.role);
    if (!dto.login && !dto.password) {
      throw new BadRequestException("O'zgartiradigan hech narsa yo'q");
    }

    const data: Prisma.TenantUserUpdateInput = {};
    if (dto.login) {
      data.login = dto.login.trim().toLowerCase();
    }
    if (dto.password) {
      data.passwordHash = await argon2.hash(dto.password);
      data.passwordEncrypted = null;
    }

    try {
      const tenantUser = await this.prisma.tenantUser.update({
        where: { id: employee.tenantUserId },
        data,
        select: { login: true },
      });
      if (dto.password) {
        await this.prisma.tenantRefreshToken.updateMany({
          where: { tenantUserId: employee.tenantUserId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return { login: tenantUser.login };
    } catch (err) {
      throw this.translateLoginConflict(err);
    }
  }

  /**
   * Xodimni butunlay o'chiradi — kabineti, davomat va oylik tarixi ham
   * (sxemada shu jadvallar `onDelete: Cascade` bilan bog'langan). Qaytarib
   * bo'lmaydigan amal, shuning uchun parolni ko'rsatishdagi kabi WebAuthn
   * bilan tasdiqlangan qisqa umrli "reveal token" talab qilinadi.
   */
  async remove(caller: TenantAuthenticatedUser, id: string, revealToken: string) {
    const scope = toTenantScope(caller);
    if (!verifyRevealToken(this.jwt, revealToken, scope.userId)) {
      throw new UnauthorizedException("Qurilma tasdiqlanmagan yoki muddati tugagan");
    }
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true, fullName: true, isActive: true, tenantUserId: true, employeeNo: true, organizationId: true, branchId: true },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    // Butunlay o'chirish faqat arxivdan (masalan xato kiritilgan xodim) — ishdan
    // ketgan xodim arxivlanadi, shunda tarixi yo'qolmaydi
    if (employee.isActive) {
      throw new BadRequestException("Avval xodimni arxivlang — butunlay o'chirish faqat arxivdan");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.delete({ where: { id: employee.id } });
      if (employee.tenantUserId) {
        // Kabinet xodimsiz ma'nosiz — birga o'chadi (refresh tokenlar cascade bilan ketadi).
        await tx.tenantUser.delete({ where: { id: employee.tenantUserId } });
      }
    });
    await this.auditLog.logFromUser(caller, {
      action: "employee.delete",
      entityType: "Employee",
      entityId: id,
      branchId,
      summary: `${employee.fullName} xodimi o'chirildi`,
    });
    // Yuz tanish terminallaridan ham o'chiriladi (raqami oldindan olingan — xodim yozuvi endi yo'q)
    await this.faceIdCommands.enqueueDelete({
      organizationId: employee.organizationId,
      branchId: employee.branchId,
      employeeNo: employee.employeeNo,
    });
    return { id: employee.id };
  }

  async countActive(scope: TenantScope) {
    return this.prisma.employee.count({
      where: { organizationId: scope.organizationId, branchId: scope.branchId ?? undefined, isActive: true },
    });
  }

  /**
   * Xodim suratini saqlaydi. Rasm brauzerda kvadrat qilib kesilib, yuz
   * aniqlangan holda keladi — server faqat hajmini tekshiradi.
   */
  async updateAvatar(scope: TenantScope, id: string, dto: UpdateEmployeeAvatarDto) {
    const employee = await this.requireWritableEmployee(scope, id);

    const [header, base64] = dto.image.split(",", 2);
    const mimeType = header.slice("data:".length, header.indexOf(";"));
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength === 0) {
      throw new BadRequestException("Rasm bo'sh");
    }
    if (buffer.byteLength > MAX_EMPLOYEE_AVATAR_BYTES) {
      throw new BadRequestException("Rasm hajmi juda katta");
    }

    let avatar: Buffer<ArrayBuffer> | null = buffer;
    let avatarKey: string | null = null;
    if (this.r2.enabled) {
      avatarKey = this.r2.buildKey(scope.organizationId, R2_CATEGORY.EMPLOYEE_AVATAR);
      await this.r2.uploadBuffer(avatarKey, buffer, mimeType);
      avatar = null;
    }

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: { avatar, avatarKey, avatarMimeType: mimeType, avatarUpdatedAt: new Date() },
      select: { avatarUpdatedAt: true },
    });
    // DB yozuvi muvaffaqiyatli bo'lgandan KEYIN o'chiriladi — aks holda DB
    // yozuvi muvaffaqiyatsiz bo'lsa, eski qator allaqachon o'chirilgan keyga
    // ishora qilib qolib ketardi.
    if (employee.avatarKey && this.r2.enabled) {
      await this.r2.deleteObject(employee.avatarKey);
    }
    // Yangi surat yuz tanish terminallariga ham yuboriladi
    await this.faceIdCommands.enqueueFace(employee.id);
    return { avatarUpdatedAt: updated.avatarUpdatedAt };
  }

  async removeAvatar(scope: TenantScope, id: string) {
    const employee = await this.requireWritableEmployee(scope, id);
    const previous = await this.prisma.employee.update({
      where: { id: employee.id },
      data: { avatar: null, avatarKey: null, avatarMimeType: null, avatarUpdatedAt: null },
      select: { avatarKey: true },
    });
    if (previous.avatarKey) {
      await this.r2.deleteObject(previous.avatarKey);
    }
    return { avatarUpdatedAt: null };
  }

  /** Binar surat. */
  /**
   * Rasmni ko'rish — o'qish huquqi yetarli. Ilgari yozish tekshiruvi
   * (requireWritableEmployee) ishlatilardi, shuning uchun moliyachi va
   * o'qituvchi xodimlar ro'yxatida rasmlarni ko'ra olmasdi (403). Moliyachi
   * butun tarmoqni ko'radi, filialga biriktirilgan boshqa rollar — o'z filialini.
   */
  async readAvatar(scope: TenantScope, id: string) {
    const ownBranchOnly = scope.branchId && scope.role !== "FINANCE";
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, ...(ownBranchOnly ? { branchId: scope.branchId! } : {}) },
      select: { avatar: true, avatarKey: true, avatarMimeType: true },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    return employee;
  }

  /**
   * Xodim tafsilot oynasidagi "Mavzu qo'shasizmi?" ro'yxati. Bu yerdagi har
   * bir mavzu aslida `LessonTopic` — xodim dars beradigan har bir guruhda
   * alohida nusxa sifatida yaratiladi (pastdagi `addTopic`ga qarang), shuning
   * uchun bir xil nomli bir nechta nusxa bo'lishi mumkin — ro'yxatda nomi
   * bo'yicha bittadan ko'rsatiladi.
   */
  async listTopics(scope: TenantScope, employeeId: string) {
    await this.requireWritableEmployee(scope, employeeId);
    return this.prisma.lessonTopic.findMany({
      where: { employeeId },
      distinct: ["title"],
      orderBy: { createdAt: "asc" },
      select: { id: true, employeeId: true, title: true, createdAt: true },
    });
  }

  /**
   * Mavzu inputidagi tavsiyalar — xodimning o'ziga tegishli dars
   * jadvalidagi fan nomlari (takrorlanmagan holda).
   */
  async listTopicSuggestions(scope: TenantScope, employeeId: string) {
    await this.requireWritableEmployee(scope, employeeId);
    const rows = await this.prisma.lessonSchedule.findMany({
      where: { employeeId, subject: { not: null } },
      distinct: ["subject"],
      select: { subject: true },
    });
    return rows.map((row) => row.subject).filter((subject): subject is string => !!subject);
  }

  /**
   * "Mavzu qo'shasizmi?" almashtirgichi. Yoqilsa — administrator mavzularni
   * shu yerdan markazlashtirib boshqaradi va xodimning o'zi "Savol-javob"
   * sahifasida ("/my-lessons/topics") yangi mavzu qo'sha olmay qoladi
   * (serverda `LessonTopicsService.resolveActingEmployeeId` bloklaydi).
   */
  async setTopicsManagedByAdmin(scope: TenantScope, employeeId: string, dto: UpdateEmployeeTopicsSettingDto) {
    await this.requireWritableEmployee(scope, employeeId);
    return this.prisma.employee.update({
      where: { id: employeeId },
      data: { topicsManagedByAdmin: dto.managedByAdmin },
      select: { id: true, topicsManagedByAdmin: true },
    });
  }

  /**
   * Mavzu xodimning o'ziga biriktiriladi: u dars beradigan har bir guruhning
   * "Savol-javob" ro'yxatida bir vaqtda paydo bo'lishi uchun shu guruhlar
   * soniga qarab bir nechta `LessonTopic` yaratiladi (sanasi — bugungi kun).
   */
  async addTopic(scope: TenantScope, employeeId: string, dto: CreateEmployeeTopicDto) {
    const employee = await this.requireWritableEmployee(scope, employeeId);
    const title = dto.title.trim();
    const teachingGroups = await this.prisma.groupTeacher.findMany({
      where: { employeeId },
      select: { groupId: true },
    });
    if (teachingGroups.length === 0) {
      throw new BadRequestException("Xodim hali birorta guruhga biriktirilmagan — avval guruhga qo'shing");
    }
    const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);
    const [firstTopic] = await this.prisma.$transaction(
      teachingGroups.map(({ groupId }) =>
        this.prisma.lessonTopic.create({
          data: { branchId: employee.branchId, groupId, employeeId, title, date: today },
        }),
      ),
    );
    return firstTopic;
  }

  /** Bu nomdagi mavzuni xodimning barcha guruhlaridan birdaniga o'chiradi. */
  async removeTopic(scope: TenantScope, employeeId: string, topicId: string) {
    await this.requireWritableEmployee(scope, employeeId);
    const topic = await this.prisma.lessonTopic.findFirst({ where: { id: topicId, employeeId } });
    if (!topic) {
      throw new NotFoundException("Mavzu topilmadi");
    }
    await this.prisma.lessonTopic.deleteMany({ where: { employeeId, title: topic.title } });
  }

  /** Yozish uchun: xodim shu tashkilot/filialda. */
  private async requireWritableEmployee(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true, branchId: true, avatarKey: true },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    return employee;
  }

  /**
   * Guruhlar shu filialga tegishli ekanini tekshiradi — boshqa filialning
   * guruhini biriktirib, o'qituvchini o'zga filialga kirgizib yubormaslik uchun.
   */
  private async assertGroupsBelongToBranch(branchId: string, groupIds: string[]) {
    if (groupIds.length === 0) {
      return;
    }
    const found = await this.prisma.group.count({ where: { id: { in: groupIds }, branchId } });
    if (found !== new Set(groupIds).size) {
      throw new NotFoundException("Guruhlardan biri bu filialda topilmadi");
    }
  }

  private translateLoginConflict(err: unknown): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new ConflictException("Bu login band — boshqasini tanlang");
    }
    return err;
  }
}
