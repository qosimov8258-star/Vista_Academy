import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { ChildrenService } from "../../src/modules/children/children.service";
import type { TenantAuthenticatedUser } from "../../src/modules/iam/tenant-auth.types";

const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

function callerOf(role: string, branchId: string | null = "branch-a") {
  return { id: "u1", userId: "u1", organizationId: "org-a", branchId, role, fullName: "Xodim" } as unknown as TenantAuthenticatedUser;
}

function setup(childGroup = "g-a") {
  const saved: unknown[] = [];
  const faces: string[] = [];
  const logs: { action: string; summary: string }[] = [];
  const prisma = {
    child: {
      findFirst: async () => ({ id: "c1", branchId: "branch-a", groupId: childGroup, avatarKey: null, fullName: "Ali", avatarUpdatedAt: null }),
      update: async (args: { data: unknown }) => {
        saved.push(args.data);
        return { avatarUpdatedAt: new Date(), avatarKey: null };
      },
    },
    employee: { findUnique: async () => ({ teachingGroups: [{ groupId: "g-a" }] }) },
  };
  const service = new ChildrenService(
    prisma as never,
    { logFromUser: async (_u: unknown, entry: { action: string; summary: string }) => logs.push(entry) } as never,
    {} as never,
    { enqueueChildFace: async (id: string) => faces.push(id) } as never,
    { enabled: false } as never,
  );
  return { service, saved, faces, logs };
}

describe("bola surati", () => {
  it("o'qituvchi o'z guruhidagi bolaga qo'yadi: bola suratiga yoziladi va Face ID'ga ketadi", async () => {
    const { service, saved, faces, logs } = setup();
    await service.updateAvatar(callerOf("TEACHER"), "c1", { image: PNG });
    expect(saved.length).toBe(1);
    expect(faces).toEqual(["c1"]);
    expect(logs[0].action).toBe("child.avatar");
  });

  it("o'qituvchi boshqa guruh bolasiga qo'ya olmaydi", async () => {
    const { service, saved, faces } = setup("g-b");
    await expect(service.updateAvatar(callerOf("TEACHER"), "c1", { image: PNG })).rejects.toThrow("guruhingizda emas");
    expect(saved.length).toBe(0);
    expect(faces).toEqual([]);
  });

  it("moliyachi, oshpaz va Super Admin qo'ya olmaydi", async () => {
    for (const caller of [callerOf("FINANCE"), callerOf("CHEF"), callerOf("NETWORK_ADMIN", null)]) {
      const { service, saved } = setup();
      await expect(service.updateAvatar(caller, "c1", { image: PNG })).rejects.toThrow("");
      expect(saved.length).toBe(0);
    }
  });

  it("administrator qo'yadi", async () => {
    const { service, faces } = setup();
    await service.updateAvatar(callerOf("MANAGER"), "c1", { image: PNG });
    expect(faces).toEqual(["c1"]);
  });

  it("o'qituvchi suratni o'chira olmaydi", async () => {
    const { service, saved } = setup();
    await expect(service.removeAvatar({ organizationId: "org-a", branchId: "branch-a", role: "TEACHER", userId: "u1" } as never, "c1")).rejects.toThrow("O'qituvchi");
    expect(saved.length).toBe(0);
  });
});
