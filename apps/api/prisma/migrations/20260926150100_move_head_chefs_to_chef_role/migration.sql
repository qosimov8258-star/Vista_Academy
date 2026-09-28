-- Ilgari "Bosh oshpaz" lavozimidagi xodim TEACHER roli bilan kirardi va
-- oshxona huquqi lavozim nomi bo'yicha berilardi. Endi ular CHEF roliga
-- o'tkaziladi (lavozim nomi kodda xuddi shunday — kichik harf, bo'shliqsiz — solishtirilgan).
UPDATE "tenant_users" AS tu
SET "role" = 'CHEF'
FROM "employees" AS e
WHERE e."tenant_user_id" = tu."id"
  AND tu."role" = 'TEACHER'
  AND lower(btrim(e."position")) = 'bosh oshpaz';
