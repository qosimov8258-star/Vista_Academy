/**
 * Tuzatish: FINANCE (Moliyachi) TenantUser'lari uchun `Employee`
 * kartochkasi yaratilgan edi (bir qismi `backfill-admin-employees.ts`
 * orqali, bir qismi undan oldingi eski ma'lumot). Qaror o'zgardi —
 * Moliyachining oyligi tizim orqali emas, Super Admin tomonidan alohida
 * hal qilinadi, shuning uchun Moliyachi moliya panelidagi "Xodimlar va
 * maosh sxemasi" ro'yxatida va umumiy "Xodimlar" sahifasida umuman
 * ko'rinmasligi kerak.
 *
 * Bu skript bog'langan TenantUser roli FINANCE bo'lgan BARCHA `Employee`
 * yozuvlarini o'chiradi (lavozim yorlig'idan qat'i nazar — "Moliyachi",
 * "Kassir" va h.k.). Faqat `Employee` kartochkasi o'chadi — `TenantUser`
 * (login/kabinet) tegilmaydi, Moliyachi hamon tizimga kira oladi.
 *
 * Ishga tushirish (apps/api papkasidan):
 *   npx ts-node --transpile-only -r dotenv/config scripts/remove-finance-employees.ts
 */
import { PrismaClient } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

async function main() {
  const candidates = await prisma.employee.findMany({
    where: { tenantUser: { role: "FINANCE" } },
    select: { id: true, fullName: true, position: true, tenantUser: { select: { login: true } } },
  });

  console.log(`Topildi: ${candidates.length} ta Moliyachi xodim kartochkasi.`);
  for (const c of candidates) {
    console.log(`  - ${c.fullName} (${c.position}, login: ${c.tenantUser?.login})`);
  }

  if (candidates.length === 0) {
    return;
  }

  const result = await prisma.employee.deleteMany({
    where: { id: { in: candidates.map((c) => c.id) } },
  });
  console.log(`O'chirildi: ${result.count} ta xodim kartochkasi.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
