/**
 * Face ID servislari sinovi uchun juda kichik in-memory "Prisma". Faqat shu
 * servislar ishlatadigan metodlar va `where` operatorlari (teng, in, not,
 * lt, lte, gt, gte) bor. Haqiqiy bazaga tegmaydi — sinovlar umumiy dev
 * bazani buzmasin.
 */
import { randomUUID } from "crypto";

type Row = Record<string, any>;

function eq(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return a === b;
}

function cmp(a: any, b: any): number {
  const x = a instanceof Date ? a.getTime() : a;
  const y = b instanceof Date ? b.getTime() : b;
  return x < y ? -1 : x > y ? 1 : 0;
}

function matchValue(value: any, cond: any): boolean {
  if (cond !== null && typeof cond === "object" && !(cond instanceof Date)) {
    if ("in" in cond && !cond.in.some((v: any) => eq(value, v))) return false;
    if ("not" in cond && eq(value, cond.not)) return false;
    if ("lt" in cond && !(value != null && cmp(value, cond.lt) < 0)) return false;
    if ("lte" in cond && !(value != null && cmp(value, cond.lte) <= 0)) return false;
    if ("gt" in cond && !(value != null && cmp(value, cond.gt) > 0)) return false;
    if ("gte" in cond && !(value != null && cmp(value, cond.gte) >= 0)) return false;
    return true;
  }
  return eq(value, cond);
}

export function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond === undefined) return true;
    // Kompozit unikal kalit: { employeeId_date: { employeeId, date } }
    if (key.includes("_") && cond && typeof cond === "object" && !(cond instanceof Date) && !("in" in cond)) {
      const parts = key.split("_");
      if (parts.every((p) => p in cond)) return parts.every((p) => eq(row[p], cond[p]));
    }
    return matchValue(row[key], cond);
  });
}

function applyData(row: Row, data: Row) {
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    if (value && typeof value === "object" && "increment" in value) row[key] = (row[key] ?? 0) + value.increment;
    else row[key] = value;
  }
  if ("updatedAt" in row) row.updatedAt = new Date();
}

class Table {
  rows: Row[] = [];
  private seq = 0;

  constructor(
    private readonly defaults: () => Row = () => ({}),
    private readonly unique: string[][] = [],
  ) {}

  private violates(candidate: Row): boolean {
    return this.unique.some((keys) => this.rows.some((r) => keys.every((k) => eq(r[k], candidate[k]))));
  }

  private insert(data: Row): Row {
    const row: Row = { id: randomUUID(), seq: ++this.seq, createdAt: new Date(), updatedAt: new Date(), ...this.defaults(), ...data };
    if (this.violates(row)) {
      const err = new Error("Unique constraint failed") as Error & { code: string };
      err.code = "P2002";
      throw err;
    }
    this.rows.push(row);
    return row;
  }

  findMany = async (args: Row = {}) => {
    let out = this.rows.filter((r) => matches(r, args.where));
    if (args.orderBy) {
      const [[key, dir]] = Object.entries(args.orderBy as Row);
      out = [...out].sort((a, b) => cmp(a[key], b[key]) * (dir === "desc" ? -1 : 1));
    }
    if (args.take) out = out.slice(0, args.take);
    return out.map((r) => ({ ...r }));
  };
  findFirst = async (args: Row = {}) => (await this.findMany({ ...args, take: 1 }))[0] ?? null;
  findUnique = async (args: Row) => this.findFirst(args);
  findUniqueOrThrow = async (args: Row) => {
    const row = await this.findFirst(args);
    if (!row) throw new Error("Not found");
    return row;
  };
  create = async (args: Row) => ({ ...this.insert(args.data) });
  createMany = async (args: Row) => {
    let count = 0;
    for (const data of args.data as Row[]) {
      try {
        this.insert(data);
        count++;
      } catch (err) {
        if (!args.skipDuplicates) throw err;
      }
    }
    return { count };
  };
  update = async (args: Row) => {
    const row = this.rows.find((r) => matches(r, args.where));
    if (!row) throw new Error("Record to update not found");
    applyData(row, args.data);
    return { ...row };
  };
  updateMany = async (args: Row) => {
    const rows = this.rows.filter((r) => matches(r, args.where));
    rows.forEach((r) => applyData(r, args.data));
    return { count: rows.length };
  };
}

export function createFakePrisma() {
  const prisma = {
    branch: new Table(),
    employee: new Table(() => ({ isActive: true, avatar: null, avatarMimeType: null, avatarUpdatedAt: null })),
    faceIdDevice: new Table(() => ({ status: "ACTIVE", lastSeenAt: null })),
    faceIdEvent: new Table(() => ({}), [["deviceId", "serialNo", "eventTime"]]),
    faceIdCommand: new Table(() => ({ status: "PENDING", attempts: 0, lastError: null, sentAt: null, completedAt: null })),
    faceEnrollment: new Table(() => ({ status: "PENDING", notes: null, registeredAt: null })),
    employeeAttendance: new Table(() => ({ note: null, checkInTime: null, checkOutTime: null }), [["employeeId", "date"]]),
    staffAttendanceLock: new Table(() => ({}), [["branchId", "date"]]),
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  return prisma;
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
