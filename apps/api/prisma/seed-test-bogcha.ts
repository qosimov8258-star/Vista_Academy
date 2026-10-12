/**
 * Bir martalik test ma'lumoti: 1 ta tashkilot, 4 filial, 40 oddiy xodim +
 * 1 moliyachi, 100 o'quvchi (har biriga vasiy bilan). Doimiy fayl emas —
 * ishlatib bo'lingach o'chiriladi. Ishga tushirish:
 *
 *   npx ts-node --transpile-only -r dotenv/config prisma/seed-test-bogcha.ts
 */
import { Gender, GuardianRelation, Prisma, PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import "dotenv/config";
import { createChildWithGuardian, withPublicIdRetry } from "../src/modules/children/child-creation";
import { encryptSecret } from "../src/common/crypto/reversible-secret";
import { DEFAULT_POSITIONS } from "../src/common/constants/default-positions";
import { DEFAULT_SUBJECTS } from "../src/common/constants/default-subjects";

const prisma = new PrismaClient();

const ORG_NAME = "Test Bog'cha";
const BRANCH_NAMES = ["1-filial", "2-filial", "3-filial", "4-filial"];
const ADMIN_LOGIN = "test-bogcha-admin";
const ADMIN_PASSWORD = "Test12345!";
const FINANCE_LOGIN = "test-bogcha-moliya";
const FINANCE_PASSWORD = "Moliya12345!";
const CHILDREN_PER_BRANCH = 25;
const GROUPS_PER_BRANCH = ["1-guruh", "2-guruh"];

const MALE_FIRST_NAMES = [
  "Alisher", "Sanjar", "Farrux", "Oybek", "Shuhrat", "Akmal", "Bahrom", "Rustam",
  "Ulug'bek", "Zafar", "Anvar", "Qodir", "Said", "Tohir", "Murod", "Jasur",
  "Bekzod", "Jahongir", "Sardor", "Sherzod", "Komil", "Davron", "Botir", "Islom",
  "Sarvar", "Asror", "Nodir", "Elyor", "Shoxrux", "Diyor",
];
const FEMALE_FIRST_NAMES = [
  "Dilnoza", "Nilufar", "Gulnora", "Sevara", "Madina", "Zilola", "Kamola", "Nargiza",
  "Shahnoza", "Feruza", "Malika", "Dildora", "Ziyoda", "Shaxzoda", "Munisa", "Mohira",
  "Lola", "Gulbahor", "Sarvinoz", "Nodira", "Oydin", "Mehriniso", "Zarina", "Kumush",
  "Umida", "Yulduz", "Sabina", "Farida", "Robiya", "Zebo",
];
const SURNAME_STEMS = [
  "Karim", "Rahim", "Toshpo'lat", "Ahmad", "Yusuf", "Botir", "Sodiq", "Davron",
  "Islom", "G'ani", "Sharof", "Habib", "Nodir", "Jahongir", "Bekzod", "Alisher",
  "Sanjar", "Farrux", "Oybek", "Shuhrat", "Akmal", "Bahrom", "Rustam", "Ulug'bek",
  "Zafar", "Anvar", "Qodir", "Said", "Tohir", "Murod",
];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function fullName(firstName: string, lastName: string): string {
  return `${lastName} ${firstName}`.trim();
}

function employeeName(i: number, gender: "M" | "F") {
  const firstName = gender === "M" ? pick(MALE_FIRST_NAMES, i) : pick(FEMALE_FIRST_NAMES, i);
  const stem = pick(SURNAME_STEMS, i + 7);
  const lastName = `${stem}${gender === "M" ? "ov" : "ova"}`;
  return { firstName, lastName };
}

async function generateUniqueSlug(base: string): Promise<string> {
  let candidate = base;
  let suffix = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.organization.findUnique({ where: { slug: candidate } });
    if (!existing) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
}

async function main() {
  const plan = await prisma.plan.findUnique({ where: { code: "plan-500" } });
  if (!plan) {
    throw new Error("plan-500 topilmadi — avval `npm run prisma:seed --workspace=apps/api` ishga tushiring");
  }

  const slug = await generateUniqueSlug("test-bogcha");

  const { organization, branches } = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: { name: ORG_NAME, slug },
    });

    const branches = [];
    for (const name of BRANCH_NAMES) {
      const branch = await tx.branch.create({
        data: { organizationId: organization.id, name, slug: slugifyBranch(name) },
      });
      branches.push(branch);
    }

    await tx.wallet.create({ data: { organizationId: organization.id, balance: 0 } });
    await tx.position.createMany({
      data: DEFAULT_POSITIONS.map((name) => ({ organizationId: organization.id, name })),
    });
    await tx.subject.createMany({
      data: DEFAULT_SUBJECTS.map((name) => ({ organizationId: organization.id, name })),
    });

    const adminPasswordHash = await argon2.hash(ADMIN_PASSWORD);
    await tx.tenantUser.create({
      data: {
        organizationId: organization.id,
        login: ADMIN_LOGIN,
        passwordHash: adminPasswordHash,
        passwordEncrypted: encryptSecret(ADMIN_PASSWORD),
        fullName: "Test Super Admin",
        role: "NETWORK_ADMIN",
      },
    });

    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);
    await tx.subscription.create({
      data: {
        organizationId: organization.id,
        planId: plan.id,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });

    return { organization, branches };
  });

  console.log(`Tashkilot yaratildi: ${organization.name} (${organization.slug})`);

  // --- Guruhlar (har filialda 2 tadan) ---
  const groupsByBranch = new Map<string, { id: string; name: string }[]>();
  for (const branch of branches) {
    const groups = [];
    for (const name of GROUPS_PER_BRANCH) {
      const group = await prisma.group.create({
        data: { branchId: branch.id, name, capacity: 20 },
      });
      groups.push(group);
    }
    groupsByBranch.set(branch.id, groups);
  }
  console.log(`${branches.length * GROUPS_PER_BRANCH.length} ta guruh yaratildi`);

  // --- Xodimlar: har filialga 10 tadan (jami 40) ---
  const EMPLOYEE_PLAN: { position: string; gender: "M" | "F"; subjects?: string[] }[] = [
    { position: "Tarbiyachi", gender: "F" },
    { position: "Tarbiyachi", gender: "F" },
    { position: "Tarbiyachi", gender: "F" },
    { position: "Tarbiyachi", gender: "F" },
    { position: "Tarbiyachi", gender: "M" },
    { position: "Tarbiyachi yordamchisi", gender: "F" },
    { position: "Fan o'qituvchisi", gender: "F", subjects: [DEFAULT_SUBJECTS[0]] },
    { position: "Bosh oshpaz", gender: "F" },
    { position: "Oshpaz yordamchisi", gender: "F" },
    { position: "Idish yuvuchi", gender: "M" },
  ];

  let employeeCount = 0;
  let nameSeed = 0;
  for (const branch of branches) {
    for (const plan of EMPLOYEE_PLAN) {
      const { firstName, lastName } = employeeName(nameSeed, plan.gender);
      nameSeed += 1;
      await prisma.employee.create({
        data: {
          organizationId: organization.id,
          branchId: branch.id,
          firstName,
          lastName,
          fullName: fullName(firstName, lastName),
          position: plan.position,
          subjects: plan.subjects ?? [],
        },
      });
      employeeCount += 1;
    }
  }
  console.log(`${employeeCount} ta xodim yaratildi`);

  // --- 1 ta moliyachi (Kassir lavozimi, FINANCE roli, kabinet bilan) ---
  const financeBranch = branches[0];
  const financePasswordHash = await argon2.hash(FINANCE_PASSWORD);
  const financeTenantUser = await prisma.tenantUser.create({
    data: {
      organizationId: organization.id,
      branchId: financeBranch.id,
      login: FINANCE_LOGIN,
      passwordHash: financePasswordHash,
      passwordEncrypted: encryptSecret(FINANCE_PASSWORD),
      fullName: "Test Moliyachi",
      role: "FINANCE",
    },
  });
  await prisma.employee.create({
    data: {
      organizationId: organization.id,
      branchId: financeBranch.id,
      firstName: "Test",
      lastName: "Moliyachi",
      fullName: "Moliyachi Test",
      position: "Kassir",
      tenantUserId: financeTenantUser.id,
    },
  });
  console.log(`1 ta moliyachi yaratildi (${FINANCE_LOGIN})`);

  // --- 100 o'quvchi: har filialga 25 tadan, guruhlarga teng taqsimlangan ---
  const CHILD_FIRST: Record<"MALE" | "FEMALE", string[]> = {
    MALE: ["Amirbek", "Sardorbek", "Diyorbek", "Islombek", "Sherali", "Ruslan", "Samandar", "Abdulloh", "Mironshoh", "Shahzod"],
    FEMALE: ["Amira", "Mohira", "Robiyaxon", "Sevinch", "Asal", "Zarnigor", "Hilola", "Madinabonu", "Sofiya", "Xadicha"],
  };
  const CHILD_SURNAME_STEMS = ["Yo'ldosh", "Normurod", "Egamberdi", "Xoliq", "Nazar", "Yusup", "Qudrat", "Shoxrux", "G'ulom", "Berdi"];

  let childCount = 0;
  let phoneSeq = 1;
  for (const branch of branches) {
    const groups = groupsByBranch.get(branch.id)!;
    for (let i = 0; i < CHILDREN_PER_BRANCH; i++) {
      const gender: Gender = i % 2 === 0 ? "MALE" : "FEMALE";
      const firstName = pick(CHILD_FIRST[gender], i);
      const stem = pick(CHILD_SURNAME_STEMS, i + 3);
      const lastName = `${stem}${gender === "MALE" ? "ov" : "ova"}`;
      const group = groups[i % groups.length];

      const guardianGender: "M" | "F" = gender === "MALE" ? "F" : "M"; // ko'pincha ona/ota bola jinsiga qarama-qarshi bo'lmaydi, lekin test uchun aralash
      const guardianFirst = pick(guardianGender === "F" ? FEMALE_FIRST_NAMES : MALE_FIRST_NAMES, phoneSeq);
      const guardianStem = pick(SURNAME_STEMS, phoneSeq + 11);
      const guardianLastName = `${guardianStem}${guardianGender === "F" ? "ova" : "ov"}`;
      const guardianRelation: GuardianRelation = guardianGender === "F" ? "MOTHER" : "FATHER";
      const phone = `99${String(1000000 + phoneSeq).padStart(7, "0")}`;
      phoneSeq += 1;

      const birthYear = new Date().getFullYear() - randomInt(2, 6);
      const birthDate = new Date(birthYear, randomInt(0, 11), randomInt(1, 28));

      await withPublicIdRetry(() =>
        prisma.$transaction((tx) =>
          createChildWithGuardian(
            tx,
            {
              organizationId: organization.id,
              branchId: branch.id,
              groupId: group.id,
              firstName,
              lastName,
              gender,
              birthDate,
              guardian: {
                fullName: fullName(guardianFirst, guardianLastName),
                phone,
                relation: guardianRelation,
                password: "",
              },
            },
            {},
          ),
        ),
      );
      childCount += 1;
    }
  }
  console.log(`${childCount} ta o'quvchi yaratildi`);

  console.log("\n=== Xulosa ===");
  console.log(`Tashkilot: ${organization.name}  (slug: ${organization.slug})`);
  console.log(`Kirish:    http://localhost:3101/${organization.slug}/login`);
  console.log(`Super Admin: login=${ADMIN_LOGIN}  parol=${ADMIN_PASSWORD}`);
  console.log(`Moliyachi:   login=${FINANCE_LOGIN}  parol=${FINANCE_PASSWORD}`);
  console.log(`Filiallar: ${branches.map((b) => b.name).join(", ")}`);
  console.log(`Xodimlar: ${employeeCount + 1} (shu jumladan 1 moliyachi)`);
  console.log(`O'quvchilar: ${childCount}`);
}

function slugifyBranch(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
