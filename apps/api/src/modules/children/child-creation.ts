import { Gender, GuardianRelation, Prisma } from "@prisma/client";
import { normalizePhone } from "../../common/phone";

/** Birinchi blok: id10000..id19999, keyin 20000-liklar va hokazo. */
const FIRST_BLOCK = 1;
const LAST_BLOCK = 9;
const BLOCK_SIZE = 10_000;

/** publicId to'qnashuvi kutilgan hodisa — shuncha marta qayta uriniladi. */
const PUBLIC_ID_RETRIES = 3;

/**
 * Tashkilot ichida bo'sh public_id tanlaydi.
 *
 * Alohida hisoblagich saqlanmaydi — bo'sh raqam bevosita `children` jadvalidan
 * so'raladi, ya'ni haqiqat manbai bitta. Blok tugamaguncha keyingisiga
 * o'tilmaydi, chunki so'rov bo'sh qaytmaguncha navbatdagi blok ko'rilmaydi.
 *
 * `ORDER BY random()` ketma-ket raqam berilishining oldini oladi (12345, 12346
 * kabi emas). 10 000 qatorlik generate_series indeks bo'yicha anti-join bilan
 * millisekunddan kam vaqt oladi.
 */
export async function allocateChildPublicId(
  tx: Prisma.TransactionClient,
  organizationId: string,
): Promise<number> {
  for (let block = FIRST_BLOCK; block <= LAST_BLOCK; block++) {
    const start = block * BLOCK_SIZE;
    const end = start + BLOCK_SIZE - 1;

    const rows = await tx.$queryRaw<{ public_id: number }[]>`
      SELECT s AS public_id
      FROM generate_series(${start}::int, ${end}::int) AS s
      WHERE NOT EXISTS (
        SELECT 1 FROM children c
        WHERE c.organization_id = ${organizationId} AND c.public_id = s
      )
      ORDER BY random()
      LIMIT 1
    `;

    if (rows.length > 0) {
      return Number(rows[0].public_id);
    }
  }

  throw new Error("5 xonali bola ID lari tugadi — raqam uzunligini oshirish kerak");
}

export interface ChildGuardianInput {
  fullName: string;
  phone: string;
  relation: GuardianRelation;
}

export interface CreateChildInput {
  organizationId: string;
  branchId: string;
  groupId?: string | null;
  firstName: string;
  lastName: string;
  /** Eski yozuvlarda jins noma'lum bo'lishi mumkin, yangi bolada esa majburiy. */
  gender?: Gender | null;
  birthDate?: Date | null;
  guardian: ChildGuardianInput;
}

/**
 * Ro'yxatlarda, eksportda va hisob-fakturada ko'rinadigan yagona nom.
 * Tartib "Familiya Ism" — hujjatlar va alifbo bo'yicha saralash shunga tayanadi.
 */
export function composeChildFullName(lastName: string, firstName: string): string {
  return `${lastName.trim()} ${firstName.trim()}`.trim();
}

/**
 * Bolani yaratadi, unga qisqa ID beradi va asosiy vasiyni bog'laydi.
 *
 * Bolaning o'z telefoni bo'lmaydi — bog'cha ota-ona bilan aloqaga chiqadi,
 * shuning uchun vasiy majburiy. Telefon `Guardian` da saqlanadi, `Child` da
 * emas: bildirishnomalar moduli va "kim olib ketishi mumkin" huquqlari aynan
 * `ChildGuardian` orqali ishlaydi.
 *
 * Ham yangi bola qo'shishda, ham CRM arizasini bolaga aylantirishda shu
 * funksiya ishlatiladi — ikkala yo'l bir xil natija bersin.
 */
export async function createChildWithGuardian<T extends Prisma.ChildInclude>(
  tx: Prisma.TransactionClient,
  input: CreateChildInput,
  include: T,
) {
  const publicId = await allocateChildPublicId(tx, input.organizationId);
  const phone = normalizePhone(input.guardian.phone);

  // Aka-uka/opa-singil qo'shilganda bir xil telefon bo'yicha mavjud vasiy
  // topiladi va ikkala bola bitta ota-onaga bog'lanadi.
  const guardian =
    (await tx.guardian.findFirst({ where: { organizationId: input.organizationId, phone } })) ??
    (await tx.guardian.create({
      data: {
        organizationId: input.organizationId,
        fullName: input.guardian.fullName.trim(),
        phone,
      },
    }));

  return tx.child.create({
    data: {
      organizationId: input.organizationId,
      branchId: input.branchId,
      groupId: input.groupId ?? undefined,
      publicId,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      fullName: composeChildFullName(input.lastName, input.firstName),
      gender: input.gender ?? undefined,
      birthDate: input.birthDate ?? undefined,
      guardians: {
        create: { guardianId: guardian.id, relation: input.guardian.relation, isPrimary: true },
      },
    },
    include,
  });
}

/**
 * Ikki xodim bir vaqtda bola qo'shsa, ikkalasi bir xil raqamni tanlab qolishi
 * mumkin. Buni `@@unique([organizationId, publicId])` ushlaydi — shu yerda
 * amal qaytadan bajariladi.
 */
export async function withPublicIdRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await run();
    } catch (err) {
      const isPublicIdRace =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        String(err.meta?.target ?? "").includes("public_id");

      if (!isPublicIdRace || attempt >= PUBLIC_ID_RETRIES) {
        throw err;
      }
    }
  }
}

/** UI da ko'rsatiladigan ko'rinish. Bazada raqam sifatida saqlanadi. */
export function formatChildPublicId(publicId: number): string {
  return `id${publicId}`;
}
