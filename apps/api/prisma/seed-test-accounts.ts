/**
 * Lokal sinov uchun: barcha panellarga 5 tadan test akkaunt. Qayta ishga
 * tushirsa ham xato bermaydi — bor akkauntlarga tegmaydi, yetishmaganini qo'shadi.
 *
 *   npx ts-node --transpile-only -r dotenv/config prisma/seed-test-accounts.ts
 */
import { PrismaClient, type TenantUserRole } from "@prisma/client";
import * as argon2 from "argon2";
import "dotenv/config";
import { encryptSecret } from "../src/common/crypto/reversible-secret";
import { DEFAULT_POSITIONS } from "../src/common/constants/default-positions";
import { DEFAULT_SUBJECTS } from "../src/common/constants/default-subjects";
import { createChildWithGuardian, withPublicIdRetry } from "../src/modules/children/child-creation";

const prisma = new PrismaClient();

const SLUG = "local-test";
const PASSWORD = "Test12345!";
const COUNT = 5;

const TENANT_ROLES: { role: TenantUserRole; prefix: string; label: string; position?: string; branch: boolean }[] = [
  { role: "NETWORK_ADMIN", prefix: "super", label: "Super Admin", branch: false },
  { role: "BRANCH_ADMIN", prefix: "filial", label: "Filial admini", branch: true },
  { role: "FINANCE", prefix: "moliya", label: "Moliyachi", position: "Kassir", branch: true },
  { role: "MANAGER", prefix: "admin", label: "Administrator", position: "Administrator", branch: true },
  { role: "TEACHER", prefix: "tarbiyachi", label: "Tarbiyachi", position: "Tarbiyachi", branch: true },
  { role: "CHEF", prefix: "oshpaz", label: "Bosh oshpaz", position: "Bosh oshpaz", branch: true },
];

async function main() {
  const plan = await prisma.plan.findUnique({ where: { code: "plan-500" } });
  if (!plan) throw new Error("plan-500 topilmadi — avval `npm run prisma:seed` ishga tushiring");

  const hash = await argon2.hash(PASSWORD);

  // --- Platforma paneli (platform-web, 3100) ---
  for (let i = 1; i <= COUNT; i++) {
    const login = `platforma${i}`;
    const exists = await prisma.platformUser.findUnique({ where: { login } });
    if (exists) continue;
    await prisma.platformUser.create({
      data: {
        login,
        passwordHash: hash,
        fullName: `Test Platforma ${i}`,
        role: i <= 3 ? "PLATFORM_SUPER_ADMIN" : "PLATFORM_SUPPORT",
      },
    });
  }

  // --- Tashkilot, filiallar, guruhlar ---
  let org = await prisma.organization.findUnique({ where: { slug: SLUG } });
  if (!org) {
    org = await prisma.$transaction(async (tx) => {
      const created = await tx.organization.create({ data: { name: "Lokal Test Bog'cha", slug: SLUG } });
      await tx.wallet.create({ data: { organizationId: created.id, balance: 0 } });
      await tx.position.createMany({ data: DEFAULT_POSITIONS.map((name) => ({ organizationId: created.id, name })) });
      await tx.subject.createMany({ data: DEFAULT_SUBJECTS.map((name) => ({ organizationId: created.id, name })) });
      const now = new Date();
      const end = new Date(now);
      end.setFullYear(end.getFullYear() + 1);
      await tx.subscription.create({
        data: { organizationId: created.id, planId: plan.id, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: end },
      });
      return created;
    });
  }

  const branches = [];
  for (const [i, name] of ["1-filial", "2-filial"].entries()) {
    const slug = `filial-${i + 1}`;
    const branch =
      (await prisma.branch.findFirst({ where: { organizationId: org.id, slug } })) ??
      (await prisma.branch.create({ data: { organizationId: org.id, name, slug } }));
    branches.push(branch);
  }

  const groups = [];
  for (const branch of branches) {
    for (const name of ["1-guruh", "2-guruh"]) {
      const group =
        (await prisma.group.findFirst({ where: { branchId: branch.id, name } })) ??
        (await prisma.group.create({ data: { branchId: branch.id, name, capacity: 20 } }));
      groups.push(group);
    }
  }

  // --- Bog'cha paneli (admin-web, 3101): har rolga 5 tadan ---
  for (const spec of TENANT_ROLES) {
    for (let i = 1; i <= COUNT; i++) {
      const login = `${spec.prefix}${i}`;
      if (await prisma.tenantUser.findUnique({ where: { organizationId_login: { organizationId: org.id, login } } })) continue;

      const branch = spec.branch ? branches[(i - 1) % branches.length] : null;
      const user = await prisma.tenantUser.create({
        data: {
          organizationId: org.id,
          branchId: branch?.id,
          login,
          passwordHash: hash,
          passwordEncrypted: encryptSecret(PASSWORD),
          fullName: `Test ${spec.label} ${i}`,
          role: spec.role,
        },
      });

      if (spec.position && branch) {
        const employee = await prisma.employee.create({
          data: {
            organizationId: org.id,
            branchId: branch.id,
            firstName: `${spec.label} ${i}`,
            lastName: "Test",
            fullName: `Test ${spec.label} ${i}`,
            position: spec.position,
            tenantUserId: user.id,
          },
        });
        if (spec.role === "TEACHER") {
          const own = groups.filter((g) => g.branchId === branch.id);
          await prisma.groupTeacher.createMany({
            data: [{ groupId: own[(i - 1) % own.length].id, employeeId: employee.id }],
            skipDuplicates: true,
          });
        }
      }
    }
  }

  // --- Ota-ona kabineti: 5 ta ota-ona, har birida bitta bola ---
  for (let i = 1; i <= COUNT; i++) {
    const phone = `+99890000000${i}`;
    if (await prisma.guardian.findFirst({ where: { organizationId: org.id, phone } })) continue;
    const group = groups[(i - 1) % groups.length];
    await withPublicIdRetry(() =>
      prisma.$transaction((tx) =>
        createChildWithGuardian(
          tx,
          {
            organizationId: org.id,
            branchId: group.branchId,
            groupId: group.id,
            firstName: `Bola${i}`,
            lastName: "Test",
            gender: i % 2 ? "MALE" : "FEMALE",
            birthDate: new Date(new Date().getFullYear() - 4, 0, 10),
            guardian: { fullName: `Test Ota-ona ${i}`, phone, relation: i % 2 ? "FATHER" : "MOTHER", password: PASSWORD },
          },
          {},
        ),
      ),
    );
  }

  console.log("Tayyor.");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
