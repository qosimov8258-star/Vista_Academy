import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { GalleryService } from "../../src/modules/gallery/gallery.service";
import type { TenantScope } from "../../src/modules/iam/tenant-auth.types";

const scope = { organizationId: "org-a", branchId: "branch-a", role: "BRANCH_ADMIN", userId: "u1" } as TenantScope;
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** Push yuborilishini kutadi: notifyParents fonda (void) ishlaydi */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

function setup({ recent = 0, parentOverrides = {} as Record<string, boolean> } = {}) {
  const sent: Array<{ guardianIds: string[]; payload: { title: string; body: string; url?: string } }> = [];
  const childGuardianWhere: unknown[] = [];
  const prisma = {
    group: { findFirst: async () => ({ id: "g1", branchId: "branch-a" }) },
    galleryItem: {
      count: async () => recent,
      create: async () => ({
        id: "item-1",
        branchId: "branch-a",
        groupId: "g1",
        title: null,
        likesCount: 0,
        createdById: "u1",
        createdAt: new Date(),
        group: { id: "g1", name: "Quyoshcha" },
        createdBy: { id: "u1", fullName: "Admin" },
        branch: { timezone: "Asia/Tashkent" },
        _count: { images: 0 },
      }),
    },
    childGuardian: {
      findMany: async (args: { where: unknown }) => {
        childGuardianWhere.push(args.where);
        return [{ guardianId: "gd1" }, { guardianId: "gd2" }];
      },
    },
    organization: {
      findUnique: async (args: { select: Record<string, unknown> }) =>
        "slug" in args.select
          ? { slug: "test-bogcha" }
          : { featureOverrides: {}, panelFeatureOverrides: { PARENT: parentOverrides }, subscription: null },
    },
  };
  const r2 = { enabled: false };
  const push = { sendToGuardians: async (guardianIds: string[], payload: { title: string; body: string; url?: string }) => void sent.push({ guardianIds, payload }) };
  const service = new GalleryService(prisma as never, r2 as never, push as never);
  return { service, sent, childGuardianWhere };
}

describe("galereya — yangi ish uchun push", () => {
  it("guruh ota-onalariga galereya havolasi bilan yuboradi", async () => {
    const { service, sent, childGuardianWhere } = setup();
    await service.create(scope, { groupId: "g1", image: PNG });
    await settle();
    expect(sent.length).toBe(1);
    expect(sent[0].guardianIds).toEqual(["gd1", "gd2"]);
    expect(sent[0].payload.url).toBe("/ota-ona/test-bogcha/galereya");
    expect(sent[0].payload.body.includes("Quyoshcha")).toBe(true);
    // Faqat shu guruh, faol bolalar, bildirishnoma olishga rozi vasiylar
    expect(childGuardianWhere[0]).toEqual({ canReceiveNotifications: true, child: { groupId: "g1", status: "ACTIVE" } });
  });

  it("10 daqiqa ichida ketma-ket yuklansa — ikkinchi push yo'q", async () => {
    const { service, sent } = setup({ recent: 1 });
    await service.create(scope, { groupId: "g1", image: PNG });
    await settle();
    expect(sent.length).toBe(0);
  });

  it("ota-onalar panelida galereya o'chiq bo'lsa — push yo'q", async () => {
    const { service, sent } = setup({ parentOverrides: { gallery: false } });
    await service.create(scope, { groupId: "g1", image: PNG });
    await settle();
    expect(sent.length).toBe(0);
  });

  it("bildirishnomalar o'chiq bo'lsa — push yo'q", async () => {
    const { service, sent } = setup({ parentOverrides: { notifications: false } });
    await service.create(scope, { groupId: "g1", image: PNG });
    await settle();
    expect(sent.length).toBe(0);
  });
});
