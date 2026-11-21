import { describe, it } from "node:test";
import { validate } from "class-validator";
import { plainToInstance } from "class-transformer";
import { expect } from "../helpers/expect";
import { ProfileService } from "../../src/modules/profile/profile.service";
import { ParentAuthService } from "../../src/modules/parent/parent-auth.service";
import { UpdateLocaleDto } from "../../src/common/locale.dto";

const errorsFor = (locale: unknown) => validate(plainToInstance(UpdateLocaleDto, { locale }));

describe("til hisobga bog'langan", () => {
  it("faqat uz, ru, en qabul qilinadi", async () => {
    expect((await errorsFor("ru")).length).toBe(0);
    expect((await errorsFor("de")).length).toBe(1);
    expect((await errorsFor(undefined)).length).toBe(1);
  });

  it("xodim tili faqat o'z hisobiga yoziladi", async () => {
    let args: unknown;
    const prisma = { tenantUser: { update: async (a: unknown) => ((args = a), { locale: "ru" }) } };
    const service = new ProfileService(prisma as never, {} as never);
    const result = await service.updateLocale({ id: "u1" } as never, { locale: "ru" });
    expect(args).toEqual({ where: { id: "u1" }, data: { locale: "ru" }, select: { locale: true } });
    expect(result).toEqual({ locale: "ru" });
  });

  it("«Xodim profiliga kirish» seansida xodimning tili o'zgarmaydi", async () => {
    let called = false;
    const prisma = { tenantUser: { update: async () => ((called = true), {}) } };
    const service = new ProfileService(prisma as never, {} as never);
    let message = "";
    try {
      await service.updateLocale({ id: "u1", staffEntryIssuerId: "admin" } as never, { locale: "en" });
    } catch (err) {
      message = (err as Error).message;
    }
    expect(called).toBe(false);
    expect(message.length > 0).toBe(true);
  });

  it("ota-ona tili o'z hisobiga yoziladi", async () => {
    let args: unknown;
    const prisma = { guardian: { update: async (a: unknown) => ((args = a), { locale: "en" }) } };
    const service = new ParentAuthService(prisma as never, {} as never);
    await service.updateLocale({ id: "g1" } as never, "en");
    expect(args).toEqual({ where: { id: "g1" }, data: { locale: "en" }, select: { locale: true } });
  });
});
