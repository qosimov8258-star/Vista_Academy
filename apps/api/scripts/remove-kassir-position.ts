/**
 * Bir martalik tozalash: "Kassir" "Xodim qo'shish" lavozim katalogidan
 * (DEFAULT_POSITIONS) olib tashlandi, chunki u Moliyachi (FINANCE) rolini
 * berardi va bu lavozim real ishlatilmaydi. Yangi tashkilotlarga endi bu
 * lavozim yaratilmaydi, lekin ilgari yaratilgan tashkilotlarning `positions`
 * jadvalida eski "Kassir" yozuvi saqlanib qolgan — shu skript ularni
 * o'chiradi, shunda "Lavozimlar" oynasida ko'rinmay qoladi.
 *
 * Mavjud `Employee` yozuvlariga (position="Kassir" bo'lsa ham) tegilmaydi —
 * bu faqat katalog tozalash, tarixiy xodim ma'lumoti o'zgarmaydi.
 *
 * Ishga tushirish (apps/api papkasidan):
 *   npx ts-node --transpile-only -r dotenv/config scripts/remove-kassir-position.ts
 */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.position.deleteMany({
    where: { name: { equals: "Kassir", mode: "insensitive" } },
  });
  console.log(`O'chirilgan "Kassir" lavozim katalogi yozuvlari: ${result.count}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
