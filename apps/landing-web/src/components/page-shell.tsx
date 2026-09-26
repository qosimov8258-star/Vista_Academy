import type { ReactNode } from "react";
import { SiteHeader } from "./site-header";
import { Footer } from "./footer";
import { Reveal } from "./reveal";

/**
 * "Guruhlarimiz" ochiladigan menyusidagi har bir bo'lim sahifasi bir xil
 * qolipda: sarlavha bloki + o'z kontenti.
 * `heroImage` berilsa, bosh sahifadagi Hero bilan bir xil — butun ekran
 * kengligida, chekkadan-chekkagacha rasm ustiga sarlavha yoziladi.
 */
type HeroImage =
  | {
      src: string;
      alt: string;
      position?: string;
      /** `cover` (standart) — rasm butun joyni to'ldirib, chekkalari kesiladi. `contain` — rasm hech kesilmasdan to'liq ko'rinadi, bo'sh joy `background` bilan to'ldiriladi (masalan, admindan yuklangan, o'lchami noma'lum rasmlar uchun). */
      fit?: "cover" | "contain";
      background?: string;
      placeholder?: never;
    }
  | { src?: undefined; alt: string; position?: never; fit?: never; background?: string; placeholder: ReactNode };

export function PageShell({
  eyebrow,
  title,
  description,
  heroImage,
  belowHero,
  afterContent,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  heroImage?: HeroImage;
  /** Hero rasmning tagida, asosiy kontent konteyneridan oldin chiqadigan qo'shimcha blok. */
  belowHero?: ReactNode;
  /** Asosiy kontentdan keyin, lekin footerdan oldin, butun kenglikda chiqadigan qo'shimcha bo'lim. */
  afterContent?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main>
      <SiteHeader />

      {heroImage && (
        <Reveal direction="up" className="relative h-[360px] w-full overflow-hidden sm:h-[440px] lg:h-[520px]" style={heroImage.background || !heroImage.src ? { background: heroImage.background ?? "var(--color-tint)" } : undefined}>
          {heroImage.src ? (
            // eslint-disable-next-line @next/next/no-img-element -- statik yoki API'dan kelgan dinamik rasm
            <img
              src={heroImage.src}
              alt={heroImage.alt}
              className={`absolute inset-0 h-full w-full ${heroImage.fit === "contain" ? "object-contain" : "object-cover"}`}
              style={{ objectPosition: heroImage.position ?? "50% 0%" }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">{heroImage.placeholder}</div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent lg:bg-gradient-to-r lg:from-black/70 lg:via-black/10 lg:to-transparent" />
          <div className="absolute inset-0 flex flex-col items-center justify-end px-6 pb-10 text-center sm:pb-12 lg:flex-row lg:items-center lg:justify-start lg:px-16 lg:pb-0 lg:text-left">
            <div className="lg:max-w-[440px]">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-white/90">{eyebrow}</p>
              <h1 className="font-heading mt-2 text-[22px] font-bold leading-tight tracking-tight text-white sm:text-[34px] lg:text-[40px]">
                {title}
              </h1>
              {description && (
                <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-white/85 sm:text-[16px] lg:max-w-none">
                  {description}
                </p>
              )}
            </div>
          </div>
        </Reveal>
      )}

      {belowHero && <div className="mx-auto max-w-[1120px] px-4 pt-10 sm:pt-12">{belowHero}</div>}

      <div
        className={
          heroImage
            ? "mx-auto max-w-[1120px] px-4 pt-6 pb-16 sm:pt-8 sm:pb-20"
            : "mx-auto max-w-[1120px] px-4 py-16 sm:py-20"
        }
      >
        {!heroImage && (
          <Reveal direction="up" className="mx-auto mt-8 max-w-[720px] text-center">
            <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
              {eyebrow}
            </p>
            <h1 className="font-heading mt-3 text-[22px] font-bold leading-tight tracking-tight text-[var(--color-text)] sm:text-[30px] lg:text-[36px]">
              {title}
            </h1>
            {description && (
              <p className="mt-4 text-[16px] leading-relaxed text-[var(--color-text-muted)]">{description}</p>
            )}
          </Reveal>
        )}

        <div className="mt-12">{children}</div>
      </div>

      {afterContent}

      <Footer />
    </main>
  );
}
