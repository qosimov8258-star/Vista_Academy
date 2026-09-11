import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import { PrismaService } from "../../database/prisma.service";
import { normalizePhone } from "../../common/phone";
import { encryptSecret, decryptSecret } from "../../common/crypto/reversible-secret";
import { generateEmployeeLogin, generateEmployeePassword } from "../../common/text/generate-credentials";
import { DEFAULT_POSITIONS } from "../../common/constants/default-positions";
import { TenantScope, requireOperationalScope } from "../iam/tenant-auth.types";
import { verifyRevealToken } from "../webauthn/reveal-token";
import { CreateEmployeeDto, EmployeeAccountDto } from "./dto/create-employee.dto";
import { CreateEmployeeTopicDto } from "./dto/create-employee-topic.dto";
import { UpdateEmployeeGroupsDto } from "./dto/update-employee-groups.dto";
import { UpdateEmployeeAvatarDto } from "./dto/update-employee-avatar.dto";
import { EmployeeQueryDto } from "./dto/employee-query.dto";

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

/** Ro'yxatda kabinet holati va biriktirilgan guruhlar ham ko'rinadi. */
const employeeInclude = {
  tenantUser: { select: { id: true, login: true, role: true, isActive: true } },
  teachingGroups: { include: { group: { select: { id: true, name: true } } } },
  // Oylik sxemasi ro'yxat bilan birga keladi: aks holda tarmoq bo'ylab
  // oyliklarni ko'rsatish uchun har bir xodimga alohida so'rov ketardi.
  salaryScheme: { select: { ruleType: true, fixedAmount: true, rate: true } },
} satisfies Prisma.EmployeeInclude;

@Injectable()
export class EmployeesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async create(scope: TenantScope, dto: CreateEmployeeDto) {
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
      return { employee, credentials: null };
    }

    await this.assertGroupsBelongToBranch(branchId, dto.account.groupIds);
    const { login, password, passwordHash, passwordEncrypted } = await this.resolveCredentials(
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
            passwordEncrypted,
            fullName,
            role: "TEACHER",
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
            teachingGroups: { create: dto.account!.groupIds.map((groupId) => ({ groupId })) },
          },
          include: employeeInclude,
        });
      });
      return { employee, credentials: { login, password } };
    } catch (err) {
      throw this.translateLoginConflict(err);
    }
  }

  /**
   * Login va parolni admin bergan bo'lsa shuni ishlatadi, aks holda
   * login (`ism.familiya`) va tasodifiy parol avtomatik generatsiya
   * qiladi. Parol autentifikatsiya uchun argon2 hash sifatida, "Parolni
   * ko'rsatish" funksiyasi uchun esa alohida shifrlangan (qaytarib
   * olinadigan) ko'rinishda saqlanadi.
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
    const [passwordHash, passwordEncrypted] = await Promise.all([
      argon2.hash(password),
      Promise.resolve(encryptSecret(password)),
    ]);
    return { login, password, passwordHash, passwordEncrypted };
  }

  findAll(scope: TenantScope, query: EmployeeQueryDto) {
    const where: Prisma.EmployeeWhereInput = {
      organizationId: scope.organizationId,
      branchId: scope.branchId ?? query.branchId,
    };
    return this.prisma.employee.findMany({
      where,
      include: employeeInclude,
      orderBy: { createdAt: "desc" },
    });
  }

  /** Tarbiyachining guruhlarini almashtiradi (qo'shish/olib tashlash bitta amalda). */
  async updateGroups(scope: TenantScope, employeeId: string, dto: UpdateEmployeeGroupsDto) {
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, organizationId: scope.organizationId, branchId },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    await this.assertGroupsBelongToBranch(branchId, dto.groupIds);

    return this.prisma.$transaction(async (tx) => {
      await tx.groupTeacher.deleteMany({ where: { employeeId } });
      if (dto.groupIds.length > 0) {
        await tx.groupTeacher.createMany({
          data: dto.groupIds.map((groupId) => ({ groupId, employeeId })),
        });
      }
      return tx.employee.findUniqueOrThrow({ where: { id: employeeId }, include: employeeInclude });
    });
  }

  /** Kabineti bo'lmagan xodimga keyinchalik login ochish. Login/parol avtomatik generatsiya qilinadi. */
  async openAccount(scope: TenantScope, employeeId: string, dto: EmployeeAccountDto) {
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
    await this.assertGroupsBelongToBranch(branchId, dto.groupIds);
    const { login, password, passwordHash, passwordEncrypted } = await this.resolveCredentials(
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
            passwordEncrypted,
            fullName: employee.fullName,
            role: "TEACHER",
          },
        });
        await tx.groupTeacher.deleteMany({ where: { employeeId } });
        await tx.groupTeacher.createMany({
          data: dto.groupIds.map((groupId) => ({ groupId, employeeId })),
        });
        return tx.employee.update({
          where: { id: employeeId },
          data: { tenantUserId: tenantUser.id },
          include: employeeInclude,
        });
      });
      return { employee: updated, credentials: { login, password } };
    } catch (err) {
      throw this.translateLoginConflict(err);
    }
  }

  /**
   * Xodimga yangi parol generatsiya qiladi (bir martalik javobda qaytadi).
   * Bu yerda WebAuthn talab qilinmaydi — admin hozir shu sessiyada, o'zi
   * turib yangi parol yaratmoqda. Eski seanslar darhol yopiladi.
   */
  async regeneratePassword(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true, tenantUserId: true },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    if (!employee.tenantUserId) {
      throw new BadRequestException("Bu xodimning kabineti yo'q");
    }

    const password = generateEmployeePassword();
    const [passwordHash, passwordEncrypted] = await Promise.all([
      argon2.hash(password),
      Promise.resolve(encryptSecret(password)),
    ]);
    await this.prisma.tenantUser.update({
      where: { id: employee.tenantUserId },
      data: { passwordHash, passwordEncrypted },
    });
    await this.prisma.tenantRefreshToken.updateMany({
      where: { tenantUserId: employee.tenantUserId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { password };
  }

  /**
   * Xodim kabineti parolini ko'rsatadi. WebAuthn bilan tasdiqlangan qisqa
   * umrli "reveal token" talab qilinadi — shu tokensiz parol hech qachon
   * qaytarilmaydi.
   */
  async revealPassword(scope: TenantScope, id: string, revealToken: string) {
    if (!verifyRevealToken(this.jwt, revealToken, scope.userId)) {
      throw new UnauthorizedException("Qurilma tasdiqlanmagan yoki muddati tugagan");
    }
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { tenantUser: { select: { login: true, passwordEncrypted: true } } },
    });
    if (!employee?.tenantUser) {
      throw new NotFoundException("Xodimning kabineti yo'q");
    }
    if (!employee.tenantUser.passwordEncrypted) {
      throw new BadRequestException("Bu xodim uchun parol saqlanmagan — yangi parol generatsiya qiling");
    }
    return {
      login: employee.tenantUser.login,
      password: decryptSecret(Buffer.from(employee.tenantUser.passwordEncrypted)),
    };
  }

  /**
   * Xodimni butunlay o'chiradi — kabineti, davomat va oylik tarixi ham
   * (sxemada shu jadvallar `onDelete: Cascade` bilan bog'langan). Qaytarib
   * bo'lmaydigan amal, shuning uchun parolni ko'rsatishdagi kabi WebAuthn
   * bilan tasdiqlangan qisqa umrli "reveal token" talab qilinadi.
   */
  async remove(scope: TenantScope, id: string, revealToken: string) {
    if (!verifyRevealToken(this.jwt, revealToken, scope.userId)) {
      throw new UnauthorizedException("Qurilma tasdiqlanmagan yoki muddati tugagan");
    }
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true, tenantUserId: true },
    });
    if (!employee) {
      throw new NotFoundException("Xodim topilmadi");
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.employee.delete({ where: { id: employee.id } });
      if (employee.tenantUserId) {
        // Kabinet xodimsiz ma'nosiz — birga o'chadi (refresh tokenlar cascade bilan ketadi).
        await tx.tenantUser.delete({ where: { id: employee.tenantUserId } });
      }
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

    const updated = await this.prisma.employee.update({
      where: { id: employee.id },
      data: { avatar: buffer, avatarMimeType: mimeType, avatarUpdatedAt: new Date() },
      select: { avatarUpdatedAt: true },
    });
    return { avatarUpdatedAt: updated.avatarUpdatedAt };
  }

  async removeAvatar(scope: TenantScope, id: string) {
    const employee = await this.requireWritableEmployee(scope, id);
    await this.prisma.employee.update({
      where: { id: employee.id },
      data: { avatar: null, avatarMimeType: null, avatarUpdatedAt: null },
    });
    return { avatarUpdatedAt: null };
  }

  /** Binar surat. */
  async readAvatar(scope: TenantScope, id: string) {
    await this.requireWritableEmployee(scope, id);
    return this.prisma.employee.findUniqueOrThrow({
      where: { id },
      select: { avatar: true, avatarMimeType: true },
    });
  }

  /** Xodim tafsilot oynasidagi "Mavzu qo'shasizmi?" ro'yxati. */
  async listTopics(scope: TenantScope, employeeId: string) {
    await this.requireWritableEmployee(scope, employeeId);
    return this.prisma.employeeTopic.findMany({
      where: { employeeId },
      orderBy: { createdAt: "asc" },
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

  async addTopic(scope: TenantScope, employeeId: string, dto: CreateEmployeeTopicDto) {
    await this.requireWritableEmployee(scope, employeeId);
    return this.prisma.employeeTopic.create({
      data: { employeeId, title: dto.title.trim() },
    });
  }

  async removeTopic(scope: TenantScope, employeeId: string, topicId: string) {
    await this.requireWritableEmployee(scope, employeeId);
    const topic = await this.prisma.employeeTopic.findFirst({ where: { id: topicId, employeeId } });
    if (!topic) {
      throw new NotFoundException("Mavzu topilmadi");
    }
    await this.prisma.employeeTopic.delete({ where: { id: topicId } });
  }

  /** Yozish uchun: xodim shu tashkilot/filialda. */
  private async requireWritableEmployee(scope: TenantScope, id: string) {
    const branchId = requireOperationalScope(scope);
    const employee = await this.prisma.employee.findFirst({
      where: { id, organizationId: scope.organizationId, branchId },
      select: { id: true, branchId: true },
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
