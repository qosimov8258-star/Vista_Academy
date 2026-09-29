/**
 * `node:test` uchun juda kichik `expect` — node:assert ustida. Loyihada
 * jest yo'q (@nestjs 12 faqat ESM, jest uni CommonJS sifatida yuklay
 * olmaydi), Node'ning o'z test runner'i esa uni odatdagidek yuklaydi.
 */
import assert from "node:assert/strict";

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date) && !Buffer.isBuffer(v);
}

function assertPartial(actual: unknown, expected: unknown, path = "$") {
  if (isPlainObject(expected)) {
    assert.ok(isPlainObject(actual), `${path}: obyekt kutilgan edi, keldi ${String(actual)}`);
    for (const [key, value] of Object.entries(expected)) {
      assertPartial((actual as Record<string, unknown>)[key], value, `${path}.${key}`);
    }
    return;
  }
  assert.deepStrictEqual(actual, expected, `${path} mos kelmadi`);
}

export function expect(actual: any) {
  return {
    toBe: (expected: unknown) => assert.strictEqual(actual, expected),
    toEqual: (expected: unknown) => assert.deepStrictEqual(actual, expected),
    toMatchObject: (expected: unknown) => assertPartial(actual, expected),
    toHaveLength: (length: number) => assert.strictEqual(actual.length, length),
    toBeNull: () => assert.strictEqual(actual, null),
    toBeInstanceOf: (ctor: new (...args: any[]) => unknown) => assert.ok(actual instanceof ctor),
    toBeLessThanOrEqual: (n: number) => assert.ok(actual <= n, `${actual} <= ${n}`),
    toBeGreaterThan: (n: number) => assert.ok(actual > n, `${actual} > ${n}`),
    rejects: { toThrow: (message: string) => assert.rejects(actual, (err: Error) => err.message.includes(message)) },
  };
}
