import { PrismaClient } from "@prisma/client";
import argon2 from "argon2";

const prisma = new PrismaClient();
const ORG_ID = "7d15a521-fe4e-4969-a8dc-5d71033811af"; // AS
const BRANCH_ID = "3c9acf71-3cf6-42d1-8d2c-8c979063f636"; // Bosh filial
const LOGIN = "teacher_test";
const PASSWORD = "Teacher123!";

const passwordHash = await argon2.hash(PASSWORD);
const user = await prisma.tenantUser.create({
  data: {
    organizationId: ORG_ID,
    branchId: BRANCH_ID,
    login: LOGIN,
    passwordHash,
    fullName: "Test tarbiyachi",
    role: "TEACHER",
  },
});
console.log("created", user.login, user.role, user.branchId);
await prisma.$disconnect();
