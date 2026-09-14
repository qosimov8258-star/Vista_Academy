import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, Proverb, UsefulStatus } from "@prisma/client";
import { PrismaService } from "../../database/prisma.service";
import { AuthenticatedParent } from "./parent-auth.types";

const DEFAULT_TIMEZONE = "Asia/Tashkent";

function formatDateInTimezone(date: Date, timezone: string | null | undefined): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone ?? DEFAULT_TIMEZONE }).format(date);
}

interface ChildrenScope {
  branchIds: string[];
  groupIds: string[];
}

const POEM_INCLUDE = {
  createdBy: { select: { fullName: true } },
  group: { select: { name: true } },
  branch: { select: { timezone: true } },
} satisfies Prisma.PoemInclude;

const TALE_INCLUDE = {
  createdBy: { select: { fullName: true } },
  group: { select: { name: true } },
  branch: { select: { timezone: true } },
} satisfies Prisma.TaleInclude;

type PoemWithRelations = Prisma.PoemGetPayload<{ include: typeof POEM_INCLUDE }>;
type TaleWithRelations = Prisma.TaleGetPayload<{ include: typeof TALE_INCLUDE }>;

/**
 * Ota-ona kabinetidagi "Foydali" bo'limi — faqat o'qish. Javob maydonlari
 * `docs/foydali-api.md` §3 dagi shartnomaga qat'iy mos: nomlarini o'zgartirma.
 *
 * Ko'rinish sharti (barcha metodlarda bir xil): tashkilot mos keladi,
 * `PUBLISHED` va o'chirilmagan, va (butun filial uchun — bolaning filialida)
 * yoki (guruhga xos — bolaning guruhida). Boshqa guruh/filialniki bo'lsa
 * natija topilmaydi — chaqiruvchida shu asosda 404 qaytadi (403 emas: boshqa
 * guruhning mazmuni borligi ham bilinmasin).
 */
@Injectable()
export class ParentUsefulService {
  constructor(private readonly prisma: PrismaService) {}

  async poems(parent: AuthenticatedParent) {
    const scope = await this.childrenScope(parent);
    const rows = await this.prisma.poem.findMany({
      where: {
        organizationId: parent.organizationId,
        status: UsefulStatus.PUBLISHED,
        deletedAt: null,
        OR: [{ groupId: null, branchId: { in: scope.branchIds } }, { groupId: { in: scope.groupIds } }],
      },
      include: POEM_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toParentPoem(row));
  }

  async poem(parent: AuthenticatedParent, id: string) {
    const scope = await this.childrenScope(parent);
    const row = await this.prisma.poem.findFirst({
      where: {
        id,
        organizationId: parent.organizationId,
        status: UsefulStatus.PUBLISHED,
        deletedAt: null,
        OR: [{ groupId: null, branchId: { in: scope.branchIds } }, { groupId: { in: scope.groupIds } }],
      },
      include: POEM_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException("She'r topilmadi");
    }
    return this.toParentPoem(row);
  }

  async proverbs(parent: AuthenticatedParent) {
    const scope = await this.childrenScope(parent);
    const rows = await this.prisma.proverb.findMany({
      where: {
        organizationId: parent.organizationId,
        status: UsefulStatus.PUBLISHED,
        deletedAt: null,
        OR: [{ groupId: null, branchId: { in: scope.branchIds } }, { groupId: { in: scope.groupIds } }],
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toParentProverb(row));
  }

  async tales(parent: AuthenticatedParent) {
    const scope = await this.childrenScope(parent);
    const rows = await this.prisma.tale.findMany({
      where: {
        organizationId: parent.organizationId,
        status: UsefulStatus.PUBLISHED,
        deletedAt: null,
        OR: [{ groupId: null, branchId: { in: scope.branchIds } }, { groupId: { in: scope.groupIds } }],
      },
      include: TALE_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) => this.toParentTale(row));
  }

  async tale(parent: AuthenticatedParent, id: string) {
    const scope = await this.childrenScope(parent);
    const row = await this.prisma.tale.findFirst({
      where: {
        id,
        organizationId: parent.organizationId,
        status: UsefulStatus.PUBLISHED,
        deletedAt: null,
        OR: [{ groupId: null, branchId: { in: scope.branchIds } }, { groupId: { in: scope.groupIds } }],
      },
      include: TALE_INCLUDE,
    });
    if (!row) {
      throw new NotFoundException("Ertak topilmadi");
    }
    return this.toParentTale(row);
  }

  /** Ota-onaning bolalari qaysi filial va guruhlarga tegishli ekanini topadi (`ParentService.children()` dagidek). */
  private async childrenScope(parent: AuthenticatedParent): Promise<ChildrenScope> {
    const links = await this.prisma.childGuardian.findMany({
      where: { guardianId: parent.id, child: { organizationId: parent.organizationId } },
      select: { child: { select: { branchId: true, groupId: true } } },
    });
    const branchIds = Array.from(new Set(links.map((link) => link.child.branchId)));
    const groupIds = Array.from(
      new Set(links.map((link) => link.child.groupId).filter((groupId): groupId is string => Boolean(groupId))),
    );
    return { branchIds, groupIds };
  }

  private toParentPoem(row: PoemWithRelations) {
    return {
      id: row.id,
      title: row.title,
      author: row.author ?? null,
      addedBy: row.createdBy.fullName,
      groupName: row.group?.name ?? null,
      ageFrom: row.ageFrom,
      ageTo: row.ageTo,
      stanzas: row.stanzas,
      addedAt: formatDateInTimezone(row.createdAt, row.branch.timezone),
    };
  }

  private toParentProverb(row: Proverb) {
    return { id: row.id, text: row.text, meaning: row.meaning };
  }

  private toParentTale(row: TaleWithRelations) {
    return {
      id: row.id,
      title: row.title,
      origin: row.origin,
      minutes: row.minutes,
      paragraphs: row.paragraphs,
      moral: row.moral,
      questions: row.questions,
      addedBy: row.createdBy.fullName,
      cover: row.cover,
      addedAt: formatDateInTimezone(row.createdAt, row.branch.timezone),
    };
  }
}
