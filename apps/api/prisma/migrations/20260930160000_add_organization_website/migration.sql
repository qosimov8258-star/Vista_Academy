-- Bog'chaning mustaqil lending sayti domeni (masalan "vista-academy.uz") —
-- shu domendan kelgan "Ariza qoldirish" so'rovlari shu tashkilotga bog'lanadi.
ALTER TABLE "organizations" ADD COLUMN "website" TEXT;

CREATE UNIQUE INDEX "organizations_website_key" ON "organizations"("website");
