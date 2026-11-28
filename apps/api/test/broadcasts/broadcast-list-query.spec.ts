import { describe, it } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { expect } from "../helpers/expect";
import { BroadcastListQueryDto } from "../../src/modules/broadcasts/dto/broadcast.dto";

/** main.ts dagi global ValidationPipe bilan bir xil qoidalar */
async function errorsOf(query: Record<string, string>) {
  const dto = plainToInstance(BroadcastListQueryDto, query);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.map((e) => e.property);
}

describe("xabarlar ro'yxati so'rovi", () => {
  it("Super Admin filial ichida branchId yuboradi — 400 emas", async () => {
    expect(await errorsOf({ page: "1", limit: "20", branchId: "0f421819-19be-4b7f-b3c4-76bba2ac8fdf" })).toEqual([]);
  });

  it("branchId'siz ham ishlaydi", async () => {
    expect(await errorsOf({ page: "1", limit: "20" })).toEqual([]);
  });

  it("noto'g'ri branchId rad etiladi", async () => {
    expect(await errorsOf({ branchId: "bosh-filial" })).toEqual(["branchId"]);
  });
});
