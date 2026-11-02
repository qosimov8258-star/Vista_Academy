import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { AttendanceService } from "../../src/modules/attendance/attendance.service";
import { GuardiansService } from "../../src/modules/guardians/guardians.service";
import { GroupMaterialsService } from "../../src/modules/group-materials/group-materials.service";
import { createChildWithGuardian } from "../../src/modules/children/child-creation";
import type { TenantScope } from "../../src/modules/iam/tenant-auth.types";

const scopeOf = (role: TenantScope["role"], branchId: string | null = "branch-a"): TenantScope =>
  ({ organizationId: "org-a", branchId, role, userId: "u1" }) as TenantScope;

describe("davomat — eski ochiq oyna", () => {
  function serviceWith(records: { childId: string; status: string }[]) {
    const prisma = { attendance: { findMany: async () => records } };
    const service = new AttendanceService(prisma as never, {} as never);
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
          return {};
        },
        findMany: async () => [],
      },
      employee: { findUnique: async () => ({ teachingGroups: [{ groupId: "g-b" }] }) },
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
    return new GroupMaterialsService(prisma as never, {} as never);
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
