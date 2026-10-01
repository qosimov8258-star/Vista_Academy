/**
 * Bir martalik backfill: `tenant-users` moduli orqali yaratilgan hisoblar
 * (BRANCH_ADMIN, MANAGER va kelajakda shu modulga qo'shiladigan boshqa
 * oylik oladigan rollar) ilgari to'g'ridan-to'g'ri `TenantUser` yozuvi
 * sifatida yaratilgan va hech qachon bog'langan `Employee` kartochkasi
 * olmagan edi. Shu sababli ular moliya panelidagi "Xodimlar va maosh
 * sxemasi" ro'yxatida ko'rinmaydi va oylik sxemasi/ish haqi hisoblanmaydi.
 * NETWORK_ADMIN (Super Admin) va FINANCE (Moliyachi) bundan mustasno —
 * ularning oyligi tizim orqali emas, Super Admin tomonidan alohida hal
 * qilinadi.
 *
 * Bu skript shunday TenantUser'larni topib, har biriga mos `Employee`
 * yozuvini yaratadi (`tenant-users.service.ts`dagi `create()` bilan bir xil
 * maydon moslashuvi). Qayta ishga tushirish xavfsiz — Employee allaqachon
 * bog'langan foydalanuvchilar o'tkazib yuboriladi.
 *
 * Ishga tushirish (apps/api papkasidan):
 *   npx ts-node --transpile-only -r dotenv/config scripts/backfill-admin-employees.ts
 */
import { PrismaClient, TenantUserRole } from "@prisma/client";
import "dotenv/config";

const prisma = new PrismaClient();

/** `tenant-users.service.ts`dagi EMPLOYEE_POSITION_BY_ROLE bilan bir xil. */
const EMPLOYEE_POSITION_BY_ROLE: Partial<Record<TenantUserRole, string>> = {
  BRANCH_ADMIN: "Filial admini",
  MANAGER: "Call Operator",
};

function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim().replace(/\s+/g, " ");
  const spaceIndex = trimmed.indexOf(" ");
  if (spaceIndex === -1) {
    return { firstName: trimmed, lastName: "" };
  }
  return { firstName: trimmed.slice(0, spaceIndex), lastName: trimmed.slice(spaceIndex + 1) };
}

async function main() {
  const candidates = await prisma.tenantUser.findMany({
    where: { role: { notIn: ["NETWORK_ADMIN", "FINANCE"] } },
    select: {
      id: true,
      organizationId: true,
      branchId: true,
      fullName: true,
      role: true,
      isActive: true,
      employee: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const missing = candidates.filter((user) => !user.employee);

  console.log(
    `Jami ${candidates.length} ta oylikka loyiq login topildi, ${missing.length} tasida xodim kartochkasi yo'q.`,
  );

  const createdCounts = new Map<string, number>();
  let skippedNoBranch = 0;

  for (const user of missing) {
    if (!user.branchId) {
      // Nazariy jihatdan bo'lmasligi kerak (shu rollar doim filialga
      // biriktirilgan), lekin eski/noto'g'ri ma'lumot bo'lsa bazani
      // buzmaslik uchun o'tkazib yuboramiz va alohida sanaymiz.
      skippedNoBranch += 1;
      console.warn(`O'tkazib yuborildi (branchId yo'q): ${user.id} (${user.fullName}, ${user.role})`);
      continue;
    }

    const { firstName, lastName } = splitFullName(user.fullName);
    await prisma.employee.create({
      data: {
        organizationId: user.organizationId,
        branchId: user.branchId,
        firstName,
        lastName,
        fullName: user.fullName,
        position: EMPLOYEE_POSITION_BY_ROLE[user.role] ?? user.role,
        isActive: user.isActive,
        tenantUserId: user.id,
      },
    });
    createdCounts.set(user.role, (createdCounts.get(user.role) ?? 0) + 1);
  }

  console.log("Yaratilgan xodim kartochkalari (rol bo'yicha):");
  for (const [role, count] of createdCounts) {
    console.log(`  ${role}: ${count}`);
  }
  const totalCreated = [...createdCounts.values()].reduce((sum, n) => sum + n, 0);
  console.log(`Jami yaratildi: ${totalCreated}`);
  if (skippedNoBranch > 0) {
    console.log(`Filialsiz bo'lgani uchun o'tkazib yuborildi: ${skippedNoBranch}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
