-- Indeks nomi Prisma kutgan nom bilan mos emas edi (63 belgilik chegarada qisqartirilgan) —
-- `prisma migrate diff` har safar farq ko'rsatardi. Faqat nom o'zgaradi, ma'lumotga tegilmaydi.
ALTER INDEX "payment_reminder_dispatches_invoice_id_send_time_dispatch_key" RENAME TO "payment_reminder_dispatches_invoice_id_send_time_dispatch_d_key";
