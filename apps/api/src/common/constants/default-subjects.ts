/**
 * Yangi tashkilot ochilganda avtomatik yaratiladigan fanlar. "Fan
 * o'qituvchisi" lavozimidagi xodimga fan tanlashda shu ro'yxat tugma
 * sifatida ko'rsatiladi; kerakli fan bo'lmasa, foydalanuvchi o'zi yangisini
 * kiritadi (bu ham keyinchalik shu katalogga qo'shiladi). Ro'yxat
 * migratsiyada (add_subjects_catalog) mavjud tashkilotlarga ham bir martalik
 * backfill sifatida ishlatilgan — bu yerni o'zgartirish eski tashkilotlarga
 * ta'sir qilmaydi.
 */
export const DEFAULT_SUBJECTS = [
  "Ingliz tili",
  "Arab tili",
  "Rus tili",
  "Mental arifmetika",
  "Logopediya",
  "Gimnastika",
  "Karate",
  "Shaxmat",
  "Xoreografiya",
] as const;
