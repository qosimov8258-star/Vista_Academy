-- Oshpaz alohida rol: huquqi lavozim nomiga ("Bosh oshpaz") bog'liq bo'lmasin.
-- Yangi qiymat shu tranzaksiyada ishlatilmaydi — mavjud akkauntlar keyingi
-- migratsiyada ko'chiriladi.

-- AlterEnum
ALTER TYPE "TenantUserRole" ADD VALUE 'CHEF';
