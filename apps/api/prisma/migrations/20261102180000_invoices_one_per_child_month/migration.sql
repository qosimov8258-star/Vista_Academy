-- Bir bolaga bir oy uchun bitta amaldagi hisob-faktura: bir vaqtda kelgan ikki so'rov
-- bolani ikki baravar qarzdor qilmasin. Bekor qilingan hisob hisobga olinmaydi —
-- o'sha oyga qayta yozish mumkin. Prisma sxemasi shartli indeksni ifodalay olmaydi.
CREATE UNIQUE INDEX "invoices_child_period_active_key" ON "invoices"("child_id", "period") WHERE "status" <> 'CANCELLED';
