-- Chek tasdiqlash oynasida moliyachi ro'yxatdan "Boshqa" usulni ham
-- tanlay olishi kerak (Click/Payme/Mobil ilova/Bankomat qatoridagilarga
-- to'g'ri kelmagan holatlar uchun).

-- AlterEnum
ALTER TYPE "PaymentMethod" ADD VALUE 'OTHER';
