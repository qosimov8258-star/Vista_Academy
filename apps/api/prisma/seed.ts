import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@bogcha.uz").toLowerCase();
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "ChangeMe123!";

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
