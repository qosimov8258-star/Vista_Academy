import { afterEach, describe, it } from "node:test";
import { expect } from "../helpers/expect";
import { isTenantOrigin, isValidTenantSlug } from "../../src/common/tenant-domain";

describe("bog'cha subdomeni", () => {
  const prev = process.env.TENANT_BASE_DOMAIN;
  afterEach(() => {
    process.env.TENANT_BASE_DOMAIN = prev;
  });

  it("slug subdomen bo'la oladimi", () => {
    expect(isValidTenantSlug("babyland")).toBe(true);
    expect(isValidTenantSlug("quyoshcha-2")).toBe(true);
    expect(isValidTenantSlug("www")).toBe(false);
    expect(isValidTenantSlug("admin")).toBe(false);
    expect(isValidTenantSlug("-bog")).toBe(false);
    expect(isValidTenantSlug("a".repeat(41))).toBe(false);
  });

  it("faqat <slug>.<domen> origin'lari qabul qilinadi", () => {
    process.env.TENANT_BASE_DOMAIN = "zeeron.uz";
    expect(isTenantOrigin("https://babyland.zeeron.uz")).toBe(true);
    expect(isTenantOrigin("http://babyland.zeeron.uz")).toBe(false);
    expect(isTenantOrigin("https://zeeron.uz")).toBe(false);
    expect(isTenantOrigin("https://a.b.zeeron.uz")).toBe(false);
    expect(isTenantOrigin("https://babyland.zeeron.uz.evil.com")).toBe(false);
    expect(isTenantOrigin("https://evilzeeron.uz")).toBe(false);
  });

  it("lokalda http ham bo'ladi; domen berilmasa rejim o'chiq", () => {
    process.env.TENANT_BASE_DOMAIN = "localhost";
    expect(isTenantOrigin("http://babyland.localhost:3101")).toBe(true);
    delete process.env.TENANT_BASE_DOMAIN;
    expect(isTenantOrigin("https://babyland.zeeron.uz")).toBe(false);
  });
});
