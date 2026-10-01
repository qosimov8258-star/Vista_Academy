import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ExecutionContext } from "@nestjs/common";
import { expect } from "../helpers/expect";
import { imageExtensionForMime, UPLOAD_IMAGE_EXTENSION } from "../../src/common/constants/uploads";
import { LandingOwnerGuard } from "../../src/modules/landing/landing-owner.guard";
import { AttendanceService } from "../../src/modules/attendance/attendance.service";
import type { TenantScope } from "../../src/modules/iam/tenant-auth.types";

function contextFor(user: unknown): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => ({ user }) }) } as unknown as ExecutionContext;
}

describe("lending sayt faqat egasi tomonidan tahrirlanadi", () => {
  const writer = { id: "u1", organizationId: "org", branchId: "b1", role: "BRANCH_ADMIN" };
  const prev = process.env.LANDING_ORGANIZATION_SLUG;
  afterEach(() => {
    if (prev === undefined) delete process.env.LANDING_ORGANIZATION_SLUG;
    else process.env.LANDING_ORGANIZATION_SLUG = prev;
  });

  it("sukut bo'yicha vista-academy o'tadi, boshqa bog'cha rad etiladi", () => {
    delete process.env.LANDING_ORGANIZATION_SLUG;
    const guard = new LandingOwnerGuard();
    expect(guard.canActivate(contextFor({ organizationSlug: "vista-academy", ...writer }))).toBe(true);
    assert.throws(() => guard.canActivate(contextFor({ organizationSlug: "babyland" })), /faqat uning egasi/);
    assert.throws(() => guard.canActivate(contextFor(undefined)), /faqat uning egasi/);
  });

  it("egasi bo'lsa ham o'qituvchi rad etiladi (fayl diskka yozilishidan oldin)", () => {
    delete process.env.LANDING_ORGANIZATION_SLUG;
    const guard = new LandingOwnerGuard();
    assert.throws(() => guard.canActivate(contextFor({ ...writer, organizationSlug: "vista-academy", role: "TEACHER" })), /O'qituvchi/);
  });

  it("egasi env orqali o'zgartiriladi", () => {
    process.env.LANDING_ORGANIZATION_SLUG = "usmon";
    const guard = new LandingOwnerGuard();
    expect(guard.canActivate(contextFor({ organizationSlug: "usmon", ...writer }))).toBe(true);
    assert.throws(() => guard.canActivate(contextFor({ organizationSlug: "vista-academy", ...writer })), /faqat uning egasi/);
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
