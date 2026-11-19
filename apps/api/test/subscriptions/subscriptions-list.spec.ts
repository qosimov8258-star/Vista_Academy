import { describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { SubscriptionsService } from "../../src/modules/subscriptions/subscriptions.service";

describe("obunalar ro'yxati", () => {
  it("arxivlangan bog'chalarning obunalari chiqmaydi", async () => {
    let where: unknown;
    const prisma = { subscription: { findMany: async (args: { where?: unknown }) => ((where = args.where), []) } };
    await new SubscriptionsService(prisma as never).findAll();
    expect(where).toEqual({ organization: { status: { not: "ARCHIVED" } } });
  });
});
