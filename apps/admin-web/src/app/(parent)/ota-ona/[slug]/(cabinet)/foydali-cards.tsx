"use client";

import { useEffect, useRef, type RefObject } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BookOpen, Brain, Gamepad2, Images, Play, Puzzle, Shapes, Sparkles, Star } from "lucide-react";
import { IosIcon, type AnyIcon, type IosTint } from "@/features/director/ios-icon";
import parentStyles from "../parent.module.css";
import { articleCoverUrl, galleryImageUrl, useParentArticles, useParentGallery } from "./foydali-content";
import { useTr } from "@/i18n/tr";

/**
 * O'yinlar kartasining muqovasi — yelpig'ichdek ochilgan uchta o'yin kartasi
 * (o'yinlardagi kartalar uslubida: rangli, oq hoshiyali, oq belgi). Kartalar
 * sekin «suzib» turadi, atrofida yulduzcha, uchqun va rangli konfetti.
 */
const GAME_CARDS = [
  { icon: Shapes, bg: "var(--p-sky)", rotate: -13, shift: -54, front: false, delay: "-1.1s" },
  { icon: Puzzle, bg: "var(--p-sun)", rotate: 0, shift: 0, front: true, delay: "0s" },
  { icon: Brain, bg: "var(--p-lilac)", rotate: 13, shift: 54, front: false, delay: "-2.2s" },
];

/** Muqovadagi rangli konfetti — joyi foizda, o'lchami pikselda */
const CONFETTI = [
  { left: "7%", top: "70%", size: 8, color: "var(--p-red)" },
  { left: "17%", top: "12%", size: 6, color: "var(--p-sky)" },
  { left: "36%", top: "86%", size: 5, color: "var(--p-mint)" },
  { left: "64%", top: "7%", size: 6, color: "var(--p-red)" },
  { left: "86%", top: "80%", size: 7, color: "var(--p-sun)" },
  { left: "91%", top: "14%", size: 5, color: "var(--p-lilac)" },
];

function GameCover() {
  return (
    <span
      className="relative block h-full w-full"
      aria-hidden="true"
      style={{
        // Yumshoq rangli yog'du + mayda nuqtalar to'ri (o'yinlar bannerlaridagidek)
        backgroundImage: [
          "radial-gradient(70% 90% at 12% 0%, color-mix(in srgb, var(--p-sun) 22%, transparent), transparent 70%)",
          "radial-gradient(70% 90% at 100% 100%, color-mix(in srgb, var(--p-sky) 18%, transparent), transparent 70%)",
          "radial-gradient(circle, rgb(0 0 0 / 0.07) 1.2px, transparent 1.4px)",
        ].join(", "),
        backgroundSize: "100% 100%, 100% 100%, 16px 16px",
      }}
    >
      {CONFETTI.map((dot) => (
        <span
          key={`${dot.left}-${dot.top}`}
          className="absolute rounded-full"
          style={{ left: dot.left, top: dot.top, width: dot.size, height: dot.size, background: dot.color, opacity: 0.85 }}
        />
      ))}
      <Star
        className={clsx(parentStyles.float, "absolute left-[5%] top-[14%] h-5 w-5 -rotate-12")}
        style={{ animationDelay: "-0.6s" }}
        fill="var(--p-sun)"
        color="var(--p-sun)"
        strokeWidth={1.5}
      />
      <Sparkles
        className={clsx(parentStyles.float, "absolute right-[5%] top-[40%] h-5 w-5")}
        style={{ animationDelay: "-1.8s", color: "var(--p-lilac)" }}
        strokeWidth={2.2}
      />

      <span className="absolute inset-0 flex items-center justify-center">
        {GAME_CARDS.map(({ icon: Icon, bg, rotate, shift, front, delay }) => (
          // Tashqisi — joyi va qiyaligi, ichkisi — «suzish»
          <span
            key={rotate}
            className={clsx("absolute", front && "z-10")}
            style={{ transform: `translate(${shift}px, ${front ? -2 : 8}px) rotate(${rotate}deg)` }}
          >
            <span
              className={clsx(
                parentStyles.float,
                "relative flex items-center justify-center rounded-[18px] text-white",
                front ? "h-[88px] w-[70px]" : "h-[72px] w-[58px]",
              )}
              style={{
                background: bg,
                animationDelay: delay,
                boxShadow: "inset 0 0 0 2.5px rgba(255,255,255,0.4), 0 10px 18px -10px rgba(30,45,30,0.55)",
              }}
            >
              <Icon className={front ? "h-9 w-9" : "h-7 w-7"} strokeWidth={2.2} />
              {front && (
                // «O'ynash» belgisi — bosib o'ynaladigan narsa ekani bir qarashda bilinsin
                <span className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-[0_4px_10px_-3px_rgba(0,0,0,0.3)]">
                  <Play className="ml-0.5 h-4 w-4" fill="var(--p-mint)" color="var(--p-mint)" strokeWidth={2} />
                </span>
              )}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

/** Tasmaning o'zi oqish tezligi (piksel/soniya) — o'rtacha: bitta karta ~7 soniyada o'tadi */
const FLOW_SPEED = 36;

/**
 * «Foydali» tasmasi o'zi sekin chapga oqib turadi — ota-ona surmasa ham
 * keyingi kartalar (masalan, Galereya) borligini ko'radi. Kartalar ikki marta
 * chiziladi: birinchi to'plam o'tib bo'lgach, sezilmasdan boshiga qaytadi
 * (cheksiz aylanadi). Barmoq tekkanda, sichqoncha ustida turganda yoki
 * sahifa ko'rinmay turganda to'xtaydi; qo'yib yuborilgach biroz kutib,
 * turgan joyidan davom etadi. Qo'lda surish ham ishlayveradi.
 * «Harakatni kamaytirish» yoqilgan qurilmada oqmaydi.
 */
function useAutoFlow(ref: RefObject<HTMLDivElement | null>, count: number) {
  useEffect(() => {
    const el = ref.current;
    if (!el || count < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let last = 0;
    let pos = el.scrollLeft;
    let holdUntil = 0;
    let hovering = false;
    let touching = false;

    const tick = (now: number) => {
      const dt = last ? Math.min(now - last, 50) : 0;
      last = now;
      const first = el.children[0] as HTMLElement | undefined;
      const copy = el.children[count] as HTMLElement | undefined;
      const loop = first && copy ? copy.offsetLeft - first.offsetLeft : 0;
      const paused = touching || hovering || now < holdUntil || document.hidden || loop <= 0;
      // To'xtab turganda — qo'lda surilgan joydan davom etish uchun
      pos = paused ? el.scrollLeft : pos + (FLOW_SPEED * dt) / 1000;
      if (loop > 0 && pos >= loop) pos -= loop;
      if (!touching && (!paused || Math.abs(el.scrollLeft - pos) > 1)) el.scrollLeft = pos;
      raf = requestAnimationFrame(tick);
    };

    const hold = () => {
      holdUntil = performance.now() + 2500;
    };
    const onTouchStart = () => {
      touching = true;
    };
    const onTouchEnd = () => {
      touching = false;
      hold();
    };
    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "mouse") hovering = true;
    };
    const onLeave = () => {
      hovering = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointerdown", hold);
    el.addEventListener("wheel", hold, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointerdown", hold);
      el.removeEventListener("wheel", hold);
    };
  }, [ref, count]);
}

type SlideData = {
  key: string;
  href: string;
  icon: AnyIcon;
  tint: IosTint;
  title: string;
  text: string;
  media: React.ReactNode;
  mediaBg: string;
};

/**
 * Bosh sahifadagi «Foydali» — yonga o'zi oqib turadigan kartalar tasmasi
 * (`useAutoFlow`). Keyingi karta chetdan ko'rinib turadi va o'zi kirib
 * keladi — surish mumkinligi shundan bilinadi. Sahifaning o'zi yonga
 * surilmaydi: surilish faqat shu tasma ichida.
 * Har karta o'z funksiyasi yoqilgan bo'lsagina chiqadi.
 */
export function FoydaliCards({ slug, articlesOn, galleryOn }: { slug: string; articlesOn: boolean; galleryOn: boolean }) {
  const tr = useTr();
  const base = `/ota-ona/${slug}`;
  const articles = useParentArticles(articlesOn);
  const gallery = useParentGallery(galleryOn);
  const latest = articles.data?.[0];
  const photos = (gallery.data ?? []).slice(0, 2);
  const strip = useRef<HTMLDivElement>(null);

  const slides: SlideData[] = [];
  if (articlesOn) {
    slides.push({
      key: "articles",
      href: `${base}/maqolalar`,
      icon: BookOpen,
      tint: "indigo",
      title: tr("Ota-onalarga eslatma"),
      text: latest ? latest.title : tr("Pedagog maslahatlari va uyda mashg'ulot g'oyalari"),
      mediaBg: "color-mix(in srgb, #5856d6 12%, transparent)",
      media: latest?.hasCover ? (
        <img src={articleCoverUrl(latest)} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <BookOpen className="h-11 w-11 text-[#5856d6] opacity-60" strokeWidth={1.7} />
      ),
    });
  }
  slides.push({
    key: "games",
    href: `${base}/oyinlar`,
    icon: Gamepad2,
    tint: "green",
    title: tr("Rivojlantiruvchi o'yinlar"),
    text: tr("Xotira va diqqat"),
    mediaBg: "color-mix(in srgb, #34c759 13%, transparent)",
    media: <GameCover />,
  });
  if (galleryOn) {
    slides.push({
      key: "gallery",
      href: `${base}/galereya`,
      icon: Images,
      tint: "pink",
      title: tr("Galereya"),
      text: tr("Bolalar ishlari"),
      mediaBg: "color-mix(in srgb, #ff2d55 9%, transparent)",
      media:
        photos.length > 0 ? (
          <span className="grid h-full w-full gap-0.5" style={{ gridTemplateColumns: `repeat(${photos.length}, 1fr)` }}>
            {photos.map((item) => (
              <img key={item.id} src={galleryImageUrl(item.id)} alt="" loading="lazy" className="h-full w-full object-cover" />
            ))}
          </span>
        ) : (
          <Images className="h-11 w-11 text-[#ff2d55] opacity-60" strokeWidth={1.7} />
        ),
    });
  }

  useAutoFlow(strip, slides.length);
  // Ikkinchi nusxa — cheksiz aylanish uchun (ekran o'quvchiga va Tab'ga ko'rinmaydi)
  const loop = slides.length >= 2;

  return (
    <section className="mt-8">
      <h2 className="px-1 text-[22px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">{tr("Foydali")}</h2>

      <div ref={strip} className="-mx-4 mt-1 flex gap-3 overflow-x-auto px-4 pb-5 pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {slides.map(({ key, ...slide }) => (
          <Slide key={key} {...slide} />
        ))}
        {loop && slides.map(({ key, ...slide }) => <Slide key={`copy-${key}`} {...slide} copy />)}
      </div>
    </section>
  );
}

/** Tasmadagi bitta karta: tepada rasm, ostida plitka belgi, nom va izoh */
function Slide({
  href,
  icon,
  tint,
  title,
  text,
  media,
  mediaBg,
  copy = false,
}: Omit<SlideData, "key"> & {
  /** Aylanish uchun ikkinchi nusxa */
  copy?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-hidden={copy || undefined}
      tabIndex={copy ? -1 : undefined}
      className={clsx(
        "w-[72%] max-w-[270px] shrink-0 rounded-[var(--p-radius)] bg-[var(--p-card)] p-2 shadow-[var(--p-shadow)] transition-transform active:scale-[0.98]",
        // Qishda karta ustida qor qatlami
        parentStyles.snowCap,
      )}
    >
      <span className="flex h-[124px] items-center justify-center overflow-hidden rounded-[18px]" style={{ background: mediaBg }}>
        {media}
      </span>
      <span className="flex items-center gap-2.5 px-1.5 pb-1.5 pt-2.5">
        <IosIcon icon={icon} tint={tint} size={32} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15.5px] font-semibold leading-snug text-[var(--p-ink)]">{title}</span>
          <span className="block truncate text-[13px] text-[var(--p-muted)]">{text}</span>
        </span>
      </span>
    </Link>
  );
}
