import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { expect } from "../helpers/expect";
import { ArticleFeedbackService } from "../../src/modules/articles/article-feedback.service";
import type { TenantScope } from "../../src/modules/iam/tenant-auth.types";
import type { AuthenticatedParent } from "../../src/modules/parent/parent-auth.types";

const parent = { id: "gd1", organizationId: "org-a" } as AuthenticatedParent;
const staff = { organizationId: "org-a", branchId: "branch-a", role: "TEACHER", userId: "u1" } as TenantScope;
const director = { organizationId: "org-a", branchId: null, role: "NETWORK_ADMIN", userId: "u9" } as TenantScope;

type Row = {
  id: string;
  articleId: string;
  parentId: string | null;
  guardianId: string | null;
  staffUserId: string | null;
  body: string;
  deletedAt: Date | null;
  createdAt: Date;
};

async function rejects(promise: Promise<unknown>, type: new (...args: never[]) => Error) {
  try {
    await promise;
  } catch (error) {
    expect(error instanceof type).toBe(true);
    return;
  }
  throw new Error(`${type.name} kutilgan edi`);
}

function setup({ visible = true } = {}) {
  const comments: Row[] = [
    { id: "c1", articleId: "a1", parentId: null, guardianId: "gd2", staffUserId: null, body: "Rahmat", deletedAt: null, createdAt: new Date(1) },
    { id: "c2", articleId: "a1", parentId: "c1", guardianId: null, staffUserId: "u1", body: "Arzimaydi", deletedAt: null, createdAt: new Date(2) },
  ];
  const reactionCalls: string[] = [];
  const names: Record<string, string> = { gd1: "Dilnoza", gd2: "Malika", u1: "Tarbiyachi" };
  const withNames = (row: Row) => ({
    ...row,
    guardian: row.guardianId ? { fullName: names[row.guardianId] } : null,
    staffUser: row.staffUserId ? { fullName: names[row.staffUserId] } : null,
  });
  const matches = (row: Row, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, value]) => (row as Record<string, unknown>)[key] === value);
  const prisma = {
    articleComment: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => comments.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        comments
          .filter((row) => matches(row, where))
          .map((row) => ({ ...withNames(row), replies: comments.filter((reply) => reply.parentId === row.id && !reply.deletedAt).map(withNames) })),
      create: async ({ data }: { data: Omit<Row, "id" | "deletedAt" | "createdAt"> }) => {
        const row: Row = { ...data, id: `c${comments.length + 1}`, deletedAt: null, createdAt: new Date() };
        comments.push(row);
        return withNames(row);
      },
      update: ({ where, data }: { where: { id: string }; data: { deletedAt: Date } }) => {
        const row = comments.find((item) => item.id === where.id)!;
        row.deletedAt = data.deletedAt;
        return Promise.resolve(row);
      },
      updateMany: ({ where, data }: { where: { parentId: string }; data: { deletedAt: Date } }) => {
        for (const row of comments) if (row.parentId === where.parentId && !row.deletedAt) row.deletedAt = data.deletedAt;
        return Promise.resolve({ count: 0 });
      },
      groupBy: async () => [{ articleId: "a1", _count: { _all: comments.filter((row) => !row.deletedAt).length } }],
    },
    articleReaction: {
      groupBy: async () => [
        { articleId: "a1", kind: "LIKE", _count: { _all: 3 } },
        { articleId: "a1", kind: "DISLIKE", _count: { _all: 1 } },
      ],
      findUnique: async () => ({ kind: "LIKE" }),
      upsert: async ({ update }: { update: { kind: string } }) => void reactionCalls.push(`upsert:${update.kind}`),
      deleteMany: async () => void reactionCalls.push("delete"),
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };
  const hidden = async () => {
    if (!visible) throw new NotFoundException("Maqola topilmadi");
  };
  const articles = { assertVisibleToParent: hidden, assertVisibleToStaff: hidden };
  const service = new ArticleFeedbackService(prisma as never, articles as never);
  return { service, comments, reactionCalls };
}

describe("maqola — layk/dizlayk", () => {
  it("son va o'z bahosi qaytadi, kimligi qaytmaydi", async () => {
    const { service } = setup();
    const summary = await service.summaryForParent(parent, "a1");
    expect(summary).toEqual({ likes: 3, dislikes: 1, comments: 2, myReaction: "LIKE" });
  });

  it("null — bahoni olib tashlaydi, LIKE — yozadi/almashtiradi", async () => {
    const { service, reactionCalls } = setup();
    await service.react(parent, "a1", null);
    await service.react(parent, "a1", "DISLIKE" as never);
    expect(reactionCalls).toEqual(["delete", "upsert:DISLIKE"]);
  });

  it("ko'rinmaydigan maqolaga baho qo'yib bo'lmaydi", async () => {
    const { service } = setup({ visible: false });
    await rejects(service.react(parent, "a1", "LIKE" as never), NotFoundException);
  });
});

describe("maqola — izohlar", () => {
  it("ota-ona: o'ziniki belgilanadi, boshqaning izohini o'chira olmaydi; xodim «Bog'cha» bo'lib chiqadi", async () => {
    const { service } = setup();
    const [thread] = await service.listForParent(parent, "a1");
    expect(thread.author).toEqual({ name: "Malika", isStaff: false });
    expect(thread.mine).toBe(false);
    expect(thread.canDelete).toBe(false);
    expect(thread.replies[0].author).toEqual({ name: "Tarbiyachi", isStaff: true });
  });

  it("javobga javob — ipning boshiga ulanadi (bir daraja)", async () => {
    const { service } = setup();
    const created = await service.commentAsParent(parent, "a1", { body: "  Menda ham shunday  ", parentId: "c2" });
    expect(created.parentId).toBe("c1");
    expect(created.body).toBe("Menda ham shunday");
    expect(created.mine).toBe(true);
    expect(created.canDelete).toBe(true);
  });

  it("bo'sh izoh qabul qilinmaydi", async () => {
    const { service } = setup();
    await rejects(service.commentAsParent(parent, "a1", { body: "   " }), BadRequestException);
  });

  it("ota-ona boshqaning izohini o'chira olmaydi", async () => {
    const { service } = setup();
    await rejects(service.deleteAsParent(parent, "a1", "c1"), NotFoundException);
  });

  it("xodim istalgan izohni o'chiradi — javoblari ham yashiriladi", async () => {
    const { service, comments } = setup();
    await service.deleteAsStaff(staff, "a1", "c1");
    expect(comments.every((row) => row.deletedAt !== null)).toBe(true);
    expect(await service.listForParent(parent, "a1")).toEqual([]);
  });

  it("xodim ro'yxatida o'chirish huquqi bor; tashkilot rahbari faqat o'qiydi", async () => {
    const { service } = setup();
    const forStaff = await service.listForStaff(staff, "a1");
    expect(forStaff.canModerate).toBe(true);
    expect(forStaff.items[0].canDelete).toBe(true);
    expect(forStaff.items[0].replies[0].mine).toBe(true);
    const forDirector = await service.listForStaff(director, "a1");
    expect(forDirector.canModerate).toBe(false);
    expect(forDirector.items[0].canDelete).toBe(false);
    await rejects(service.commentAsStaff(director, "a1", { body: "Salom" }), ForbiddenException);
  });
});
