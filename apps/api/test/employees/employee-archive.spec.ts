import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { expect } from "../helpers/expect";
import { EmployeesService } from "../../src/modules/employees/employees.service";
import { ARCHIVED_EMPLOYEE_MESSAGE, HrService } from "../../src/modules/hr/hr.service";
import { StaffAttendanceService } from "../../src/modules/staff-attendance/staff-attendance.service";
import type { TenantAuthenticatedUser } from "../../src/modules/iam/tenant-auth.types";

process.env.JWT_TENANT_ACCESS_SECRET ??= "test-secret";

const admin = {
  id: "admin-user",
  organizationId: "org-a",
  branchId: "branch-a",
  role: "BRANCH_ADMIN",
  fullName: "Filial admini",
  disabledFeatures: [],
} as unknown as TenantAuthenticatedUser;
const manager = { ...admin, id: "manager-user", role: "MANAGER" } as TenantAuthenticatedUser;

type EmployeeRow = {
  id: string;
  organizationId: string;
  branchId: string;
  fullName: string;
  position: string;
  isActive: boolean;
  archivedAt: Date | null;
  tenantUserId: string | null;
  employeeNo: string;
  createdAt: Date;
};

async function rejects(promise: Promise<unknown>, type: new (...args: never[]) => Error, message?: string) {
  try {
    await promise;
  } catch (error) {
    expect(error instanceof type).toBe(true);
    if (message) expect((error as Error).message).toBe(message);
    return;
  }
  throw new Error(`${type.name} kutilgan edi`);
}

function setup(overrides: Partial<EmployeeRow> = {}, tenantRole = "TEACHER") {
  const employee: EmployeeRow = {
    id: "e1",
    organizationId: "org-a",
    branchId: "branch-a",
    fullName: "Yusupova Dilnoza",
    position: "Tarbiyachi",
    isActive: true,
    archivedAt: null,
    tenantUserId: "tu1",
    employeeNo: "1001",
    createdAt: new Date("2026-01-10T00:00:00Z"),
    ...overrides,
  };
  const tenantUser = { id: "tu1", role: tenantRole, isActive: employee.isActive };
  const calls: string[] = [];
  const audit: string[] = [];
  const face: string[] = [];
  const matchesEmployee = (where: Record<string, unknown>) =>
    where.id === employee.id && (!where.organizationId || where.organizationId === employee.organizationId);
  const withRelations = () => ({
    ...employee,
    tenantUser: employee.tenantUserId ? { ...tenantUser, login: "dilnoza" } : null,
    teachingGroups: [],
    salaryScheme: null,
  });

  const prisma = {
    employee: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => (matchesEmployee(where) ? withRelations() : null),
      update: async ({ data }: { data: Partial<EmployeeRow> }) => {
        Object.assign(employee, data);
        calls.push(`employee.update:${JSON.stringify({ isActive: data.isActive, archived: data.archivedAt instanceof Date ? "date" : data.archivedAt })}`);
        return withRelations();
      },
      delete: async () => void calls.push("employee.delete"),
    },
    tenantUser: {
      update: async ({ data }: { data: { isActive?: boolean } }) => {
        Object.assign(tenantUser, data);
        calls.push(`tenantUser.update:${data.isActive}`);
      },
      delete: async () => void calls.push("tenantUser.delete"),
    },
    tenantRefreshToken: { updateMany: async () => void calls.push("tokens.revoke") },
    groupTeacher: { deleteMany: async () => void calls.push("groupTeacher.deleteMany") },
    payrollEntry: {
      upsert: async () => {
        calls.push("payroll.upsert");
        return { id: "p1" };
      },
      findFirst: async () => ({ id: "p1", branchId: "branch-a", period: "2026-11", totalAmount: 100, employee: { fullName: employee.fullName, isActive: employee.isActive } }),
      update: async () => void calls.push("payroll.update"),
    },
    salaryScheme: {
      upsert: async () => void calls.push("salaryScheme.upsert"),
      findUnique: async () => ({ ruleType: "FIXED", fixedAmount: 100, rate: 0 }),
    },
    shift: { upsert: async () => void calls.push("shift.upsert") },
    employeeAttendance: { upsert: async () => void calls.push("attendance.upsert") },
    staffAttendanceLock: { findUnique: async () => null },
    $transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
  };
  const auditLog = { logFromUser: async (_: unknown, entry: { action: string }) => void audit.push(entry.action) };
  const faceIdCommands = {
    enqueueDelete: async ({ employeeNo }: { employeeNo: string }) => void face.push(`delete:${employeeNo}`),
    enqueueEmployeeSync: async (id: string) => void face.push(`sync:${id}`),
    enqueueFace: async (id: string) => void face.push(`face:${id}`),
  };
  const jwt = { verify: () => ({ purpose: "reveal-employee-secret", sub: admin.id }) };
  const employees = new EmployeesService(prisma as never, jwt as never, auditLog as never, {} as never, faceIdCommands as never, {} as never);
  const hr = new HrService(prisma as never, auditLog as never);
  const staffAttendance = new StaffAttendanceService(prisma as never);
  return { employees, hr, staffAttendance, employee, tenantUser, calls, audit, face };
}

describe("xodimni arxivlash", () => {
  it("archivedAt va isActive=false birga qo'yiladi, kabinet yopiladi, seanslar tugaydi, Face ID dan o'chadi", async () => {
    const { employees, employee, tenantUser, calls, audit, face } = setup();
    const result = await employees.archive(admin, "e1");
    expect(employee.isActive).toBe(false);
    expect(employee.archivedAt instanceof Date).toBe(true);
    expect(result.isActive).toBe(false);
    expect(tenantUser.isActive).toBe(false);
    expect(calls.includes("tokens.revoke")).toBe(true);
    expect(calls.includes("groupTeacher.deleteMany")).toBe(true);
    expect(audit).toEqual(["employee.archive"]);
    expect(face).toEqual(["delete:1001"]);
  });

  it("kabinetsiz xodim ham arxivlanadi (kabinetga tegilmaydi)", async () => {
    const { employees, calls } = setup({ tenantUserId: null });
    await employees.archive(admin, "e1");
    expect(calls.some((call) => call.startsWith("tenantUser") || call === "tokens.revoke")).toBe(false);
  });

  it("allaqachon arxivdagini qayta arxivlab bo'lmaydi", async () => {
    const { employees } = setup({ isActive: false, archivedAt: new Date() });
    await rejects(employees.archive(admin, "e1"), BadRequestException);
  });

  it("o'zini arxivlay olmaydi", async () => {
    const { employees } = setup({ tenantUserId: admin.id });
    await rejects(employees.archive(admin, "e1"), BadRequestException);
  });

  it("administrator filial admini kabinetli xodimni arxivlay olmaydi", async () => {
    const { employees } = setup({}, "BRANCH_ADMIN");
    await rejects(employees.archive(manager, "e1"), ForbiddenException);
  });
});

describe("arxivdan qaytarish", () => {
  it("archivedAt=null, isActive=true, kabinet ochiladi, Face ID ga qayta yoziladi", async () => {
    const { employees, employee, tenantUser, calls, audit, face } = setup({ isActive: false, archivedAt: new Date() });
    tenantUser.isActive = false;
    await employees.restore(admin, "e1");
    expect(employee.isActive).toBe(true);
    expect(employee.archivedAt).toBeNull();
    expect(tenantUser.isActive).toBe(true);
    expect(calls.includes("tokens.revoke")).toBe(false);
    expect(audit).toEqual(["employee.restore"]);
    expect(face).toEqual(["sync:e1", "face:e1"]);
  });

  it("ishlayotgan xodimni qaytarib bo'lmaydi", async () => {
    const { employees } = setup();
    await rejects(employees.restore(admin, "e1"), BadRequestException);
  });
});

describe("butunlay o'chirish", () => {
  it("ishlayotgan xodim o'chirilmaydi — avval arxivlash kerak", async () => {
    const { employees, calls } = setup();
    await rejects(employees.remove(admin, "e1", "token"), BadRequestException);
    expect(calls.includes("employee.delete")).toBe(false);
  });

  it("arxivdagi xodim o'chiriladi (kabineti bilan)", async () => {
    const { employees, calls, face } = setup({ isActive: false, archivedAt: new Date() });
    await employees.remove(admin, "e1", "token");
    expect(calls.includes("employee.delete")).toBe(true);
    expect(calls.includes("tenantUser.delete")).toBe(true);
    expect(face).toEqual(["delete:1001"]);
  });
});

describe("arxivdagi xodimga oylik va davomat yozilmaydi", () => {
  const archived = { isActive: false, archivedAt: new Date() };

  it("oylik to'lash rad etiladi", async () => {
    const { hr, calls } = setup(archived);
    await rejects(hr.payEmployeeSalary(admin, "e1", { period: "2026-11", amount: 100, method: "CASH" } as never), BadRequestException, ARCHIVED_EMPLOYEE_MESSAGE);
    expect(calls.includes("payroll.upsert")).toBe(false);
  });

  it("maosh sxemasi, smena, hisoblash va «to'landi» belgisi rad etiladi", async () => {
    const { hr, calls } = setup(archived);
    const scope = { organizationId: "org-a", branchId: "branch-a", role: "BRANCH_ADMIN", userId: admin.id } as const;
    await rejects(hr.upsertSalaryScheme(scope as never, "e1", { ruleType: "FIXED", fixedAmount: 100 } as never), BadRequestException, ARCHIVED_EMPLOYEE_MESSAGE);
    await rejects(hr.createShift(scope as never, { employeeId: "e1", date: "2026-11-01", hours: 8 } as never), BadRequestException, ARCHIVED_EMPLOYEE_MESSAGE);
    await rejects(hr.generatePayroll(admin, { employeeId: "e1", period: "2026-11" } as never), BadRequestException, ARCHIVED_EMPLOYEE_MESSAGE);
    await rejects(hr.markPayrollPaid(admin, "p1"), BadRequestException, ARCHIVED_EMPLOYEE_MESSAGE);
    expect(calls).toEqual([]);
  });

  it("davomat yozish rad etiladi", async () => {
    const { staffAttendance, calls } = setup(archived);
    const scope = { organizationId: "org-a", branchId: "branch-a", role: "BRANCH_ADMIN", userId: admin.id } as const;
    await rejects(staffAttendance.mark(scope as never, { employeeId: "e1", date: "2026-11-01", status: "PRESENT" } as never), BadRequestException);
    expect(calls.includes("attendance.upsert")).toBe(false);
  });

  it("ishlayotgan xodimga oylik to'lanadi", async () => {
    const { hr, calls } = setup();
    await hr.payEmployeeSalary(admin, "e1", { period: "2026-11", amount: 100, method: "CASH" } as never);
    expect(calls.includes("payroll.upsert")).toBe(true);
  });
});
