import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { AttendanceService } from "../../src/modules/attendance/attendance.service";
import { GuardiansService } from "../../src/modules/guardians/guardians.service";
import { GroupMaterialsService } from "../../src/modules/group-materials/group-materials.service";
import { assertGroupHasRoom, createChildWithGuardian } from "../../src/modules/children/child-creation";
import { GroupsService } from "../../src/modules/groups/groups.service";
import { CrmService } from "../../src/modules/crm/crm.service";
import type { TenantScope } from "../../src/modules/iam/tenant-auth.types";

const scopeOf = (role: TenantScope["role"], branchId: string | null = "branch-a"): TenantScope =>
  ({ organizationId: "org-a", branchId, role, userId: "u1" }) as TenantScope;

describe("davomat — eski ochiq oyna", () => {
  function serviceWith(records: { childId: string; status: string }[]) {
    const prisma = { attendance: { findMany: async () => records } };
    const service = new AttendanceService(prisma as never, {} as never, {} as never);
    const marked: string[] = [];
    service.mark = (async (_scope: TenantScope, dto: { childId: string }) => {
      marked.push(dto.childId);
      return {};
    }) as never;
    return { service, marked };
  }
  const date = "2026-01-15";

  it("boshqa xodim belgilagan bolani bosib ketmaydi va qaytaradi", async () => {
    const { service, marked } = serviceWith([{ childId: "c1", status: "ABSENT" }]);
    const result = await service.markMany(scopeOf("BRANCH_ADMIN"), {
      date,
      items: [
        { childId: "c1", status: "PRESENT", baseStatus: null },
        { childId: "c2", status: "PRESENT", baseStatus: null },
      ],
    } as never);
    expect(marked).toEqual(["c2"]);
    expect(result.conflicts).toEqual(["c1"]);
    expect(result.saved).toBe(1);
  });

  it("ikkala xodim bir xil belgilagan bo'lsa — to'qnashuv emas", async () => {
    const { service, marked } = serviceWith([{ childId: "c1", status: "PRESENT" }]);
    const result = await service.markMany(scopeOf("BRANCH_ADMIN"), {
      date,
      items: [{ childId: "c1", status: "PRESENT", baseStatus: null }],
    } as never);
    expect(marked).toEqual([]);
    expect(result.conflicts).toEqual([]);
  });

  it("xodim ko'rgan holat o'zgarmagan bo'lsa — saqlanadi", async () => {
    const { service, marked } = serviceWith([{ childId: "c1", status: "ABSENT" }]);
    const result = await service.markMany(scopeOf("BRANCH_ADMIN"), {
      date,
      items: [{ childId: "c1", status: "PRESENT", baseStatus: "ABSENT" }],
    } as never);
    expect(marked).toEqual(["c1"]);
    expect(result.conflicts).toEqual([]);
  });

  it("baseStatus yuborilmasa — avvalgidek yoziladi", async () => {
    const { service, marked } = serviceWith([{ childId: "c1", status: "ABSENT" }]);
    await service.markMany(scopeOf("BRANCH_ADMIN"), { date, items: [{ childId: "c1", status: "PRESENT" }] } as never);
    expect(marked).toEqual(["c1"]);
  });
});

describe("vasiylar", () => {
  function serviceWith(incoming: { passwordHash: string | null; isActive: boolean }) {
    let created = false;
    const prisma = {
      child: { findFirst: async () => ({ id: "c1", organizationId: "org-a", branchId: "branch-a", groupId: "g-a" }) },
      guardian: {
        findFirst: async () => ({ id: "new" }),
        findUniqueOrThrow: async () => incoming,
      },
      childGuardian: {
        // Bolaning kabineti boshqa odamda ochiq
        findFirst: async () => ({ guardian: { fullName: "Ota", phone: "+998901112233" } }),
        create: async () => {
          created = true;
          return { id: "new-link" };
        },
        findMany: async () => [],
      },
      employee: { findUnique: async () => ({ teachingGroups: [{ groupId: "g-b" }] }) },
      $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(prisma),
    };
    return { service: new GuardiansService(prisma as never), created: () => created };
  }

  it("kabineti ochiq bolaga kabinetsiz odam qo'shiladi", async () => {
    const { service, created } = serviceWith({ passwordHash: null, isActive: false });
    await service.addToChild(scopeOf("BRANCH_ADMIN"), "c1", { guardianId: "new" } as never);
    expect(created()).toBe(true);
  });

  it("ikkinchi ochiq kabinet baribir rad etiladi", async () => {
    const { service, created } = serviceWith({ passwordHash: "hash", isActive: true });
    await expect(service.addToChild(scopeOf("BRANCH_ADMIN"), "c1", { guardianId: "new" } as never)).rejects.toThrow(
      "kabineti allaqachon ochiq",
    );
    expect(created()).toBe(false);
  });

  it("tarbiyachi boshqa guruh bolasining ota-onasini ololmaydi", async () => {
    const { service } = serviceWith({ passwordHash: null, isActive: false });
    await expect(service.listForChild(scopeOf("TEACHER"), "c1")).rejects.toThrow("guruhingizda emas");
  });
});

describe("guruh fayli", () => {
  function serviceWith() {
    const prisma = {
      groupMaterial: {
        findUnique: async () => ({ groupId: "g-a", organizationId: "org-a", branchId: "branch-a", data: null, dataKey: null }),
      },
    };
    return new GroupMaterialsService(prisma as never, {} as never, {} as never);
  }

  it("boshqa filial xodimi ocholmaydi", async () => {
    await expect(serviceWith().sendForStaff(scopeOf("BRANCH_ADMIN", "branch-b"), "m1", {} as never)).rejects.toThrow("Fayl topilmadi");
  });

  it("moliyachi ocholmaydi", async () => {
    await expect(serviceWith().sendForStaff(scopeOf("FINANCE"), "m1", {} as never)).rejects.toThrow("Fayl topilmadi");
  });
});

describe("ismsiz bola", () => {
  it("bo'sh ism bilan bola yaratilmaydi", async () => {
    let touched = false;
    const tx = new Proxy({}, { get: () => { touched = true; return {}; } });
    await expect(
      createChildWithGuardian(
        tx as never,
        { organizationId: "org-a", branchId: "branch-a", firstName: "  ", lastName: "", guardian: { fullName: "Ota", phone: "901112233", relation: "FATHER" } },
        {},
      ),
    ).rejects.toThrow("Bola ismi kiritilmagan");
    expect(touched).toBe(false);
  });
});

describe("davomat — sana va coin", () => {
  const dayOffset = (days: number) => new Date(Date.now() + 5 * 3600 * 1000 - days * 86_400_000).toISOString().slice(0, 10);

  function serviceWith(child: Record<string, unknown>, existing: Record<string, unknown> | null = null) {
    const coins: unknown[] = [];
    const upserts: { create: Record<string, unknown>; update: Record<string, unknown> }[] = [];
    const logs: string[] = [];
    const pushes: unknown[] = [];
    const tx = {
      $queryRaw: async () => [],
      attendance: {
        findUnique: async () => existing,
        upsert: async (args: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
          upserts.push(args);
          return {};
        },
      },
      coinTransaction: {
        create: async (args: unknown) => {
          coins.push(args);
          return { id: "coin" };
        },
        delete: async () => ({}),
      },
    };
    const prisma = {
      child: {
        findFirst: async () => ({
          id: "c1",
          organizationId: "org-a",
          branchId: "branch-a",
          groupId: "g-a",
          fullName: "Ali",
          status: "ACTIVE",
          createdAt: new Date("2020-01-01T00:00:00Z"),
          ...child,
        }),
      },
      childGuardian: { findMany: async () => [{ guardianId: "g1", guardian: { fullName: "Ota" } }] },
      employee: { findUnique: async () => ({ teachingGroups: [{ groupId: "g-a" }], position: "Tarbiyachi" }) },
      tenantUser: { findUnique: async () => ({ employee: { position: "Tarbiyachi" } }) },
      $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    };
    const notifications = { logSystemEvent: async (args: { message: string }) => logs.push(args.message) };
    const push = { sendToGuardians: async (ids: string[]) => pushes.push(ids) };
    return { service: new AttendanceService(prisma as never, notifications as never, push as never), coins, upserts, logs, pushes };
  }
  const mark = (status: string, date: string) => ({ childId: "c1", date, status }) as never;

  it("kelajak kun rad etiladi", async () => {
    const { service } = serviceWith({});
    await expect(service.mark(scopeOf("BRANCH_ADMIN"), mark("PRESENT", dayOffset(-1)))).rejects.toThrow("Kelajak");
  });

  it("arxivdagi bolaga yozilmaydi", async () => {
    const { service } = serviceWith({ status: "INACTIVE" });
    await expect(service.mark(scopeOf("BRANCH_ADMIN"), mark("PRESENT", dayOffset(0)))).rejects.toThrow("arxivda");
  });

  it("tarbiyachi 31 kundan eski kunga yoza olmaydi, administrator yozadi", async () => {
    const { service } = serviceWith({});
    await expect(service.mark(scopeOf("TEACHER"), mark("ABSENT", dayOffset(40)))).rejects.toThrow("31 kundan");
    await service.mark(scopeOf("MANAGER"), mark("ABSENT", dayOffset(40)));
  });

  it("bugun va yaqin kunlar coin beradi, eski kun va qo'shilishidan oldingi kun bermaydi", async () => {
    let s = serviceWith({});
    await s.service.mark(scopeOf("BRANCH_ADMIN"), mark("PRESENT", dayOffset(0)));
    expect(s.coins.length).toBe(1);
    s = serviceWith({});
    await s.service.mark(scopeOf("BRANCH_ADMIN"), mark("PRESENT", dayOffset(20)));
    expect(s.coins.length).toBe(0);
    s = serviceWith({ createdAt: new Date() });
    await s.service.mark(scopeOf("BRANCH_ADMIN"), mark("PRESENT", dayOffset(2)));
    expect(s.coins.length).toBe(0);
  });

  it("kelmadi: xabar bir marta, push faqat bugungi kunga, o'tgan kunga 'bugun' deyilmaydi", async () => {
    let s = serviceWith({}, { status: "ABSENT" });
    await s.service.mark(scopeOf("BRANCH_ADMIN"), mark("ABSENT", dayOffset(0)));
    expect(s.logs.length).toBe(0);
    s = serviceWith({});
    await s.service.mark(scopeOf("BRANCH_ADMIN"), mark("ABSENT", dayOffset(0)));
    expect(s.logs[0].includes("bugun")).toBe(true);
    expect(s.pushes.length).toBe(1);
    s = serviceWith({});
    await s.service.mark(scopeOf("BRANCH_ADMIN"), mark("ABSENT", dayOffset(3)));
    expect(s.logs[0].includes("bugun")).toBe(false);
    expect(s.pushes.length).toBe(0);
  });

  it("kelmadi terminal vaqtini tozalaydi, keldi eski izohni tozalaydi", async () => {
    let s = serviceWith({}, { status: "PRESENT" });
    await s.service.mark(scopeOf("BRANCH_ADMIN"), mark("ABSENT", dayOffset(0)));
    expect(s.upserts[0].update.checkInTime).toBe(null);
    s = serviceWith({}, { status: "ABSENT", note: "Kasal" });
    await s.service.mark(scopeOf("BRANCH_ADMIN"), mark("PRESENT", dayOffset(0)));
    expect(s.upserts[0].update.note).toBe(null);
  });
});

describe("ketma-ket kelmagan bolalar", () => {
  const dayOffset = (days: number) => new Date(new Date(Date.now() + 5 * 3600 * 1000 - days * 86_400_000).toISOString().slice(0, 10) + "T00:00:00.000Z");

  function flagsFor(childDays: Record<number, string>, workedOffsets: number[], overdue = false) {
    const prisma = {
      branch: { findFirst: async () => ({ id: "branch-a" }) },
      child: { findMany: async () => [{ id: "c1", fullName: "Ali" }] },
      attendance: {
        findMany: async (args: { distinct?: string[] }) =>
          args.distinct
            ? workedOffsets.map((offset) => ({ date: dayOffset(offset) }))
            : Object.entries(childDays).map(([offset, status]) => ({ childId: "c1", date: dayOffset(Number(offset)), status })),
      },
      invoice: { findMany: async () => (overdue ? [{ childId: "c1" }] : []) },
    };
    return new AttendanceService(prisma as never, {} as never, {} as never).chronicAbsenceFlags(scopeOf("BRANCH_ADMIN"));
  }

  it("oraliqda belgilanmagan ish kuni ketma-ketlikni uzadi", async () => {
    expect(await flagsFor({ 1: "ABSENT", 3: "ABSENT", 5: "ABSENT" }, [1, 2, 3, 4, 5])).toEqual([]);
  });

  it("dam olish kunlari uzmaydi, bugun hali belgilanmagan bo'lsa ham", async () => {
    const flags = await flagsFor({ 1: "ABSENT", 4: "ABSENT", 5: "ABSENT" }, [0, 1, 4, 5]);
    expect(flags[0].consecutiveAbsentDays).toBe(3);
  });

  it("eski kelmaslik 'bugun kelmadi' bo'lmaydi", async () => {
    const flags = await flagsFor({ 6: "ABSENT" }, [0, 1, 6], true);
    expect(flags).toEqual([]);
  });
});

describe("sig'im", () => {
  const prismaWith = (active: number) => ({ child: { count: async () => active } }) as never;
  const group = { id: "g", name: "Asal", capacity: 2 };

  it("to'lgan guruh GROUP_FULL qaytaradi", async () => {
    await expect(assertGroupHasRoom(prismaWith(2), group)).rejects.toThrow("to'lgan");
  });

  it("tasdiqlansa va joy bo'lsa o'tadi", async () => {
    await assertGroupHasRoom(prismaWith(2), group, { allowOverCapacity: true });
    await assertGroupHasRoom(prismaWith(1), group);
  });
});

describe("guruh", () => {
  const caller = { id: "u1", organizationId: "org-a", branchId: "branch-a", role: "BRANCH_ADMIN", fullName: "A" } as never;

  function serviceWith(activeChildren: number) {
    let updated = false;
    const prisma = {
      group: {
        findFirst: async () => ({ id: "g", branchId: "branch-a", status: "ACTIVE", name: "Asal" }),
        update: async () => {
          updated = true;
          return { name: "Asal" };
        },
      },
      child: { count: async () => activeChildren },
    };
    const audit = { logFromUser: async () => undefined };
    return { service: new GroupsService(prisma as never, audit as never), updated: () => updated };
  }

  it("faol bolali guruh nofaol qilinmaydi", async () => {
    const { service, updated } = serviceWith(3);
    await expect(service.update(caller, "g", { status: "INACTIVE" } as never)).rejects.toThrow("3 ta faol bola");
    expect(updated()).toBe(false);
  });

  it("bo'sh guruh nofaol qilinadi", async () => {
    const { service, updated } = serviceWith(0);
    await service.update(caller, "g", { status: "INACTIVE" } as never);
    expect(updated()).toBe(true);
  });
});

describe("vasiyni olib tashlash", () => {
  function serviceWith(others: { id: string; isPrimary: boolean }[]) {
    const promoted: string[] = [];
    let deleted = false;
    const prisma = {
      childGuardian: {
        findFirst: async () => ({ id: "l1", childId: "c1", isPrimary: true, child: { organizationId: "org-a", branchId: "branch-a" } }),
        findMany: async () => others,
        delete: async () => {
          deleted = true;
          return {};
        },
        update: async ({ where }: { where: { id: string } }) => {
          promoted.push(where.id);
          return {};
        },
      },
      $transaction: async (run: (tx: unknown) => Promise<unknown>) => run(prisma),
    };
    return { service: new GuardiansService(prisma as never), promoted, deleted: () => deleted };
  }

  it("yagona vasiy olib tashlanmaydi", async () => {
    const { service, deleted } = serviceWith([]);
    await expect(service.removeLink(scopeOf("BRANCH_ADMIN"), "l1")).rejects.toThrow("kamida bitta");
    expect(deleted()).toBe(false);
  });

  it("asosiy olib tashlansa navbatdagisi asosiy bo'ladi", async () => {
    const { service, promoted } = serviceWith([{ id: "l2", isPrimary: false }]);
    await service.removeLink(scopeOf("BRANCH_ADMIN"), "l1");
    expect(promoted).toEqual(["l2"]);
  });
});

describe("fayl", () => {
  it("tarbiyachi boshqaning faylini o'chirmaydi", async () => {
    const prisma = {
      groupMaterial: { findUnique: async () => ({ id: "m", groupId: "g", organizationId: "org-a", dataKey: null, createdById: "boshqa" }) },
      group: { findFirst: async () => ({ id: "g", branchId: "branch-a", branch: { organizationId: "org-a" } }) },
      employee: { findUnique: async () => ({ teachingGroups: [{ groupId: "g" }] }) },
    };
    const service = new GroupMaterialsService(prisma as never, {} as never, {} as never);
    await expect(service.remove(scopeOf("TEACHER"), "m")).rejects.toThrow("o'zingiz yuborgan");
  });

  it("Super Admin guruh fayllarini ko'radi", async () => {
    const prisma = {
      group: { findFirst: async () => ({ id: "g" }) },
      groupMaterial: { findMany: async () => [{ id: "m" }] },
    };
    const service = new GroupMaterialsService(prisma as never, {} as never, {} as never);
    expect(await service.list(scopeOf("NETWORK_ADMIN", null), "g")).toEqual([{ id: "m" }]);
  });
});

describe("ariza", () => {
  const caller = { id: "u1", organizationId: "org-a", branchId: "branch-a", role: "BRANCH_ADMIN", fullName: "A" } as never;

  it("bolaga aylantirilgan ariza qaytarilmaydi", async () => {
    const prisma = { lead: { findFirst: async () => ({ id: "l", branchId: "branch-a", stage: "WON", convertedChildId: "c1" }) } };
    const service = new CrmService(prisma as never, {} as never);
    await expect(service.updateStage(caller, "l", { stage: "NEW" } as never)).rejects.toThrow("aylantirilgan");
  });

  it("bir vaqtda ikkinchi aylantirish bola yaratmaydi", async () => {
    let touched = false;
    const tx = {
      lead: { updateMany: async () => ({ count: 0 }) },
      $queryRaw: async () => {
        touched = true;
        return [];
      },
    };
    const prisma = {
      lead: { findFirst: async () => ({ id: "l", branchId: "branch-a", stage: "NEW", childFullName: "Ali Vali" }) },
      $transaction: async (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    };
    const service = new CrmService(prisma as never, {} as never);
    await expect(service.convert(caller, "l", {} as never)).rejects.toThrow("yakunlangan");
    expect(touched).toBe(false);
  });
});
