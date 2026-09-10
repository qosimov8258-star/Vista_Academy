import { PrismaClient, Prisma } from "@prisma/client";
import * as argon2 from "argon2";
import "dotenv/config";

const prisma = new PrismaClient();

// Bog'cha tarmoqlari uchun 3 ta qat'iy tarif reja (bolalar soniga qarab).
const TARIFF_PLANS = [
  {
    code: "plan-300",
    name: "300 tagacha",
    priceMonthly: 700000,
    maxChildren: 300,
    maxBranches: 3,
    maxEmployees: 40,
    maxStorageGb: 10,
  },
  {
    code: "plan-500",
    name: "500 tagacha",
    priceMonthly: 1200000,
    maxChildren: 500,
    maxBranches: 5,
    maxEmployees: 70,
    maxStorageGb: 20,
  },
  {
    code: "plan-700-plus",
    name: "700+ bola",
    priceMonthly: 1500000,
    maxChildren: 999999,
    maxBranches: 10,
    maxEmployees: 150,
    maxStorageGb: 50,
  },
] as const;

async function seedTariffPlans() {
  for (const plan of TARIFF_PLANS) {
    const { code, priceMonthly, ...rest } = plan;
    await prisma.plan.upsert({
      where: { code },
      update: { ...rest, priceMonthly: new Prisma.Decimal(priceMonthly) },
      create: { code, ...rest, priceMonthly: new Prisma.Decimal(priceMonthly) },
    });
  }
  console.log(`Seeded ${TARIFF_PLANS.length} tariff plans`);
}

async function main() {
  const email = (process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@bogcha.uz").toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";

  await seedTariffPlans();

  const existing = await prisma.platformUser.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super admin already exists: ${email}`);
    return;
  }

  const passwordHash = await argon2.hash(password);
  await prisma.platformUser.create({
    data: {
      email,
      passwordHash,
      fullName: "Platform Super Admin",
      role: "PLATFORM_SUPER_ADMIN",
    },
  });

  console.log(`Seeded platform super admin: ${email} / ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
