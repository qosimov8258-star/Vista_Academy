import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { imageExtensionForMime, UPLOAD_IMAGE_EXTENSION } from "../../src/common/constants/uploads";
import { LandingService } from "../../src/modules/landing/landing.service";
import { AttendanceService } from "../../src/modules/attendance/attendance.service";
import type { TenantScope } from "../../src/modules/iam/tenant-auth.types";

describe("lending kontenti — tashkilotlar orasida ajratilgan", () => {
  function serviceWithTeacher(teacher: { id: string; organizationId: string }) {
    const prisma = {
      landingTeacher: {
        findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
          teacher.id === where.id && teacher.organizationId === where.organizationId ? teacher : null,
        update: async ({ where, data }: { where: { id: string }; data: unknown }) => ({ ...teacher, ...where, ...(data as object) }),
      },
    };
    return new LandingService(prisma as never);
  }

  it("boshqa tashkilotning o'qituvchisini tahrirlashga urinish — topilmadi", async () => {
    const service = serviceWithTeacher({ id: "t1", organizationId: "org-a" });
    await expect(service.updateTeacher("org-b", "t1", { fullName: "Boshqa" } as never)).rejects.toThrow("topilmadi");
  });

  it("o'z tashkiloti o'qituvchisi — ishlaydi", async () => {
    const service = serviceWithTeacher({ id: "t1", organizationId: "org-a" });
    const updated = await service.updateTeacher("org-a", "t1", { fullName: "Yangi" } as never);
    expect(updated.fullName).toBe("Yangi");
  });
});

describe("yuklangan fayl kengaytmasi", () => {
  it("mijoz yuborgan nomdan emas, tekshirilgan MIME turidan olinadi", () => {
    expect(imageExtensionForMime("image/png")).toBe(".png");
    expect(imageExtensionForMime("image/jpeg")).toBe(".jpg");
    expect(imageExtensionForMime("image/webp")).toBe(".webp");
    expect(imageExtensionForMime("image/gif")).toBe(".gif");
    // fileFilter o'tkazmaydi, lekin baribir hech qachon .html bo'lmaydi
    expect(imageExtensionForMime("text/html")).toBe(".jpg");
  });

  it("/uploads da faqat rasm kengaytmalari rasm deb beriladi", () => {
    expect(UPLOAD_IMAGE_EXTENSION.test("/srv/uploads/landing/a.jpg")).toBe(true);
    expect(UPLOAD_IMAGE_EXTENSION.test("/srv/uploads/landing/a.WEBP")).toBe(true);
    expect(UPLOAD_IMAGE_EXTENSION.test("/srv/uploads/landing/a.html")).toBe(false);
    expect(UPLOAD_IMAGE_EXTENSION.test("/srv/uploads/landing/a.svg")).toBe(false);
  });
});

describe("surunkali kelmaganlar — boshqa tashkilot filiali", () => {
  const networkAdmin: TenantScope = { organizationId: "org-a", branchId: null, role: "NETWORK_ADMIN", userId: "u1" };
  const branchAdmin: TenantScope = { organizationId: "org-a", branchId: "branch-a", role: "BRANCH_ADMIN", userId: "u2" };

  function serviceWithBranches(branches: { id: string; organizationId: string }[]) {
    const childQueries: unknown[] = [];
    const prisma = {
      branch: {
        findFirst: async ({ where }: { where: { id: string; organizationId: string } }) =>
          branches.find((b) => b.id === where.id && b.organizationId === where.organizationId) ?? null,
      },
      child: {
        findMany: async (args: unknown) => {
          childQueries.push(args);
          return [];
        },
      },
    };
    const service = new AttendanceService(prisma as never, {} as never);
    return { service, childQueries };
  }

  it("tarmoq admini boshqa tashkilot filialini so'rasa — 404, bolalar so'ralmaydi", async () => {
    const { service, childQueries } = serviceWithBranches([{ id: "branch-b", organizationId: "org-b" }]);
    await expect(service.chronicAbsenceFlags(networkAdmin, "branch-b")).rejects.toThrow("Filial topilmadi");
    expect(childQueries.length).toBe(0);
  });

  it("filial admini boshqa filialni so'rasa — 403", async () => {
    const { service } = serviceWithBranches([{ id: "branch-a", organizationId: "org-a" }]);
    await expect(service.chronicAbsenceFlags(branchAdmin, "branch-x")).rejects.toThrow("kirish huquqingiz yo'q");
  });

  it("o'z tashkiloti filiali — ishlaydi", async () => {
    const { service, childQueries } = serviceWithBranches([{ id: "branch-a", organizationId: "org-a" }]);
    expect(await service.chronicAbsenceFlags(networkAdmin, "branch-a")).toEqual([]);
    expect(childQueries.length).toBe(1);
  });
});
