/**
 * Yangi tashkilot ochilganda avtomatik yaratiladigan lavozimlar. Xodim
 * qo'shishda shu ro'yxat tugma sifatida ko'rsatiladi; kerakli lavozim
 * bo'lmasa, foydalanuvchi o'zi yangisini kiritadi (bu ham keyinchalik shu
 * katalogga qo'shiladi). Ro'yxat migratsiyada (add_employee_name_parts_phone_positions)
 * mavjud tashkilotlarga ham bir martalik backfill sifatida ishlatilgan —
 * bu yerni o'zgartirish eski tashkilotlarga ta'sir qilmaydi.
 */
export const DEFAULT_POSITIONS = [
  "Fan o'qituvchisi",
  "Tarbiyachi",
  "Tarbiyachi yordamchisi",
  "Kassir",
  "Administrator",
  "Bosh oshpaz",
  "Oshpaz yordamchisi",
  "Idish yuvuchi",
] as const;
