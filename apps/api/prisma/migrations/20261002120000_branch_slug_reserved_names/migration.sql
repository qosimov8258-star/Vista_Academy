-- Filial slug'i bog'cha panelida manzilning ikkinchi bo'lagi (/{orgSlug}/{branchSlug}).
-- U bog'cha slug'i yoki panel sahifasi nomi bilan bir xil bo'lsa, filial havolasi
-- bosh sahifaga yoki o'sha sahifaga tushib qoladi (subdomenda
-- vista-academy.zeeron.uz/vista-academy -> bosh sahifa). Yangi filiallar uchun
-- API endi bunday slug bermaydi (branch-slug.ts) — bu yerda mavjudlari tuzatiladi.
UPDATE "branches" b
SET "slug" = b."slug" || '-filial', "updated_at" = NOW()
FROM "organizations" o
WHERE o."id" = b."organization_id"
  AND (b."slug" = o."slug" OR b."slug" IN ('login', 'ota-ona', 'api', 'children', 'groups', 'employees', 'attendance', 'lesson-attendance', 'staff-attendance', 'nutrition', 'cash', 'debtors', 'cash-report', 'group-payments', 'calls', 'board', 'pickups', 'weekly-report', 'staff-absences', 'finance', 'branches', 'users', 'crm', 'hr', 'notifications', 'lessons', 'my-lessons', 'coin', 'my-notifications', 'settings', 'useful', 'lending', 'face-id', 'audit-logs', 'daily-reports', 'network', 'reminders', 'report'))
  AND NOT EXISTS (
    SELECT 1 FROM "branches" x
    WHERE x."organization_id" = b."organization_id" AND x."slug" = b."slug" || '-filial'
  );

-- "-filial" ham band bo'lgan kamdan-kam holat: id bo'lagi bilan.
UPDATE "branches" b
SET "slug" = b."slug" || '-filial-' || SUBSTRING(b."id" FROM 1 FOR 6), "updated_at" = NOW()
FROM "organizations" o
WHERE o."id" = b."organization_id"
  AND (b."slug" = o."slug" OR b."slug" IN ('login', 'ota-ona', 'api', 'children', 'groups', 'employees', 'attendance', 'lesson-attendance', 'staff-attendance', 'nutrition', 'cash', 'debtors', 'cash-report', 'group-payments', 'calls', 'board', 'pickups', 'weekly-report', 'staff-absences', 'finance', 'branches', 'users', 'crm', 'hr', 'notifications', 'lessons', 'my-lessons', 'coin', 'my-notifications', 'settings', 'useful', 'lending', 'face-id', 'audit-logs', 'daily-reports', 'network', 'reminders', 'report'));
