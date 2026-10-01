import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { isOrganizationSuspended } from "../../src/modules/iam/organization-access";
import { GuardiansService } from "../../src/modules/guardians/guardians.service";
import type { TenantScope } from "../../src/modules/iam/tenant-auth.types";

describe("to'xtatilgan bog'cha", () => {
  it("tashkilot yoki obuna to'xtatilgan/bekor qilingan bo'lsa — yopiq", () => {
    expect(isOrganizationSuspended({ status: "ACTIVE" }, { status: "ACTIVE" })).toBe(false);
    expect(isOrganizationSuspended({ status: "ACTIVE" }, null)).toBe(false);
    expect(isOrganizationSuspended({ status: "ACTIVE" }, { status: "GRACE_PERIOD" })).toBe(false);
    expect(isOrganizationSuspended({ status: "SUSPENDED" }, { status: "ACTIVE" })).toBe(true);
    expect(isOrganizationSuspended({ status: "ACTIVE" }, { status: "SUSPENDED" })).toBe(true);
    expect(isOrganizationSuspended({ status: "ACTIVE" }, { status: "CANCELLED" })).toBe(true);
  });
});

describe("ota-ona kabineti — boshqa filial", () => {
  const branchAdmin: TenantScope = { organizationId: "org-a", branchId: "branch-a", role: "BRANCH_ADMIN", userId: "u1" };

  function serviceWith(childrenElsewhere: number) {
    let passwordChanged = false;
    const prisma = {
      guardian: {
        findFirst: async () => ({ id: "g1", fullName: "Ota", phone: "+998901112233" }),
        update: async () => {
          passwordChanged = true;
          return {};
        },
      },
      childGuardian: {
        count: async ({ where }: { where: { child: { branchId: { not: string } } } }) =>
          where.child.branchId.not === "branch-a" ? childrenElsewhere : 0,
        findMany: async () => [],
      },
      guardianRefreshToken: { updateMany: async () => ({}) },
      $transaction: async (ops: Promise<unknown>[]) => Promise.all(ops),
    };
    return { service: new GuardiansService(prisma as never), changed: () => passwordChanged };
  }

  it("boshqa filialda ham bolasi bor ota-onaning parolini yangilab bo'lmaydi", async () => {
    const { service, changed } = serviceWith(1);
    await expect(service.openCabinet(branchAdmin, "g1")).rejects.toThrow("boshqa filialda ham bolasi bor");
    expect(changed()).toBe(false);
  });

  it("barcha bolalari shu filialda bo'lsa — kabinet ochiladi", async () => {
    const { service, changed } = serviceWith(0);
    const result = await service.openCabinet(branchAdmin, "g1");
    expect(result.guardianId).toBe("g1");
    expect(changed()).toBe(true);
  });
});
