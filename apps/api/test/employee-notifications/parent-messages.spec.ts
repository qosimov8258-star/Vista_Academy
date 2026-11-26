import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { departureMessage, noteMessage, parseParentMessage } from "../../src/modules/parent/parent-messages";
import { EmployeeNotificationsService } from "../../src/modules/employee-notifications/employee-notifications.service";
import type { TenantScope } from "../../src/modules/iam/tenant-auth.types";

const scopeOf = (role: TenantScope["role"], branchId: string | null): TenantScope =>
  ({ organizationId: "org-a", branchId, role, userId: "u1" }) as TenantScope;

describe("ota-ona xabari qolipi", () => {
  it("eslatmani yozib, qayta o'qiydi", () => {
    const message = noteMessage("Valiyev Ali", "onasi", "Valiyeva Nodira", "  Soat 11 da dori ichsin ");
    expect(parseParentMessage(message)).toEqual({
      kind: "NOTE",
      childName: "Valiyev Ali",
      who: "onasi",
      parentName: "Valiyeva Nodira",
      text: "Soat 11 da dori ichsin",
    });
  });

  it("«yo'lga chiqdim»ni yozib, qayta o'qiydi", () => {
    const message = departureMessage("Valiyev Ali", "ota-onasi", "Valiyev Sardor", 15);
    expect(parseParentMessage(message)).toEqual({
      kind: "DEPARTURE",
      childName: "Valiyev Ali",
      who: "ota-onasi",
      parentName: "Valiyev Sardor",
      minutes: 15,
    });
  });

  it("dars jadvali bildirishnomasini ota-ona xabari deb olmaydi", () => {
    expect(parseParentMessage(`"Akademik" guruhida har Dushanba kuni soat 09:00–09:45 oralig'ida darsingiz bor.`)).toBeNull();
  });
});

describe("admin uchun ota-ona xabarlari", () => {
  const now = new Date();
  const note = noteMessage("Valiyev Ali", "onasi", "Valiyeva Nodira", "Dori");

  function serviceWith(rows: { id: string; branchId: string; message: string; createdAt: Date }[]) {
    const calls: { notifications?: unknown; children?: unknown } = {};
    const prisma = {
      branch: { findFirst: async () => ({ id: "branch-b" }) },
      employeeNotification: {
        findMany: async (args: unknown) => {
          calls.notifications = args;
          return rows;
        },
      },
      child: {
        findMany: async (args: unknown) => {
          calls.children = args;
          return [{ id: "child-1", branchId: "branch-a", fullName: "Valiyev Ali" }];
        },
      },
    };
    return { service: new EmployeeNotificationsService(prisma as never), calls };
  }

  it("tarbiyachi va boshqa rollarga yopiq", async () => {
    const { service } = serviceWith([]);
    await expect(service.parentMessages(scopeOf("TEACHER", "branch-a"))).rejects.toThrow("Faqat Super Admin");
  });

  it("guruhning ikki tarbiyachisiga yozilgan nusxani bittaga yig'adi va bolani topadi", async () => {
    const { service } = serviceWith([
      { id: "n1", branchId: "branch-a", message: note, createdAt: now },
      { id: "n2", branchId: "branch-a", message: note, createdAt: now },
      { id: "n3", branchId: "branch-a", message: `"Akademik" guruhida dars bor.`, createdAt: now },
    ]);
    const items = await service.parentMessages(scopeOf("BRANCH_ADMIN", "branch-a"));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: "n1", kind: "NOTE", childId: "child-1", childName: "Valiyev Ali", text: "Dori", minutes: null });
  });

  it("filial admini so'rovdagi boshqa filialni emas, o'z filialini ko'radi", async () => {
    const { service, calls } = serviceWith([]);
    await service.parentMessages(scopeOf("BRANCH_ADMIN", "branch-a"), "branch-b");
    expect(calls.notifications).toMatchObject({ where: { branchId: "branch-a" } });
  });

  it("Super Admin filialsiz — butun tashkilot bo'yicha", async () => {
    const { service, calls } = serviceWith([]);
    await service.parentMessages(scopeOf("NETWORK_ADMIN", null));
    expect(calls.notifications).toMatchObject({ where: { branch: { organizationId: "org-a" } } });
  });
});
