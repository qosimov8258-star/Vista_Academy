import type { SVGProps } from "react";

/**
 * Chaqaloq-shishasi illyustratsiyasi. Rasmdagi kompozitsiya: qalpoqchali
 * chaqaloq, atrofida uchayotgan yuraklar va nuqtali iz. Barchasi bitta SVG
 * ichida — tashqi rasm fayliga bog'liq emas.
 */
function BabyBottleIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 240 220" fill="none" aria-hidden="true" focusable="false" {...props}>
      {/* nuqtali iz */}
      <path
        d="M190 44c11 14 15 31 6 47-8 15-23 25-39 33"
        stroke="#D9D3E3"
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="1 7"
      />
      <path
        d="M182 76c-4-4-9-2-9 3 0 4 5 8 9 11 4-3 9-7 9-11 0-5-5-7-9-3z"
        fill="#F7BFD1"
      />

      {/* uchayotgan yuraklar */}
      <path d="M48 54c-3-3-7-1-7 2 0 3 4 6 7 8 3-2 7-5 7-8 0-3-4-5-7-2z" fill="#F28FAE" />
      <path d="M76 38c-2-2-5-1-5 1 0 2 3 4 5 6 2-2 5-4 5-6 0-2-3-3-5-1z" fill="#F8C6D4" />
      <path d="M33 90c-2-2-5-1-5 1 0 2 3 4 5 6 2-2 5-4 5-6 0-2-3-3-5-1z" fill="#F28FAE" />
      <path d="M170 60c-2-2-5-1-5 1 0 2 3 4 5 6 2-2 5-4 5-6 0-2-3-3-5-1z" fill="#F8C6D4" />

      {/* tanasi (kombinizon) */}
      <path d="M78 210c-6-26-2-46 10-58h64c12 12 16 32 10 58H78z" fill="#DCE8F8" />
      <path d="M88 152c-14 2-24 12-26 26 6 6 16 6 22-2 4-8 4-16 4-24z" fill="#DCE8F8" />
      <path d="M152 152c14 2 24 12 26 26-6 6-16 6-22-2-4-8-4-16-4-24z" fill="#DCE8F8" />
      <rect x="60" y="172" width="24" height="10" rx="5" fill="#FFFFFF" />
      <rect x="156" y="172" width="24" height="10" rx="5" fill="#FFFFFF" />

      {/* oyoqlari */}
      <path d="M92 208c-4 10-16 12-26 8-4-8 0-16 8-18 8-2 16 2 18 10z" fill="#DCE8F8" />
      <path d="M148 208c4 10 16 12 26 8 4-8 0-16-8-18-8-2-16 2-18 10z" fill="#DCE8F8" />
      <rect x="58" y="206" width="20" height="8" rx="4" fill="#FFFFFF" />
      <rect x="162" y="206" width="20" height="8" rx="4" fill="#FFFFFF" />

      {/* boshi */}
      <circle cx="120" cy="110" r="42" fill="#FBD9B8" />
      <circle cx="78" cy="112" r="7" fill="#FBD9B8" />
      <circle cx="162" cy="112" r="7" fill="#FBD9B8" />

      {/* sochi */}
      <path d="M104 78c4-10 16-14 24-8-6 0-10 4-12 8-4-2-8-2-12 0z" fill="#E8B978" />
      <path d="M126 74c6-6 16-6 20 2-6-2-12 0-16 4-2-2-3-4-4-6z" fill="#E8B978" />

      {/* kamon */}
      <path d="M120 66c-10-10-26-8-30 2-2 6 4 12 12 10 6-2 14-8 18-12z" fill="#9C5C79" />
      <path d="M120 66c10-10 26-8 30 2 2 6-4 12-12 10-6-2-14-8-18-12z" fill="#9C5C79" />
      <circle cx="120" cy="68" r="6" fill="#7C4560" />

      {/* yonoq va yuz */}
      <circle cx="96" cy="122" r="6" fill="#F5A9A0" opacity={0.6} />
      <circle cx="144" cy="122" r="6" fill="#F5A9A0" opacity={0.6} />
      <circle cx="104" cy="112" r="3" fill="#5B3A29" />
      <circle cx="136" cy="112" r="3" fill="#5B3A29" />
      <ellipse cx="120" cy="122" rx="4" ry="3" fill="#C98F63" />
      <path d="M112 132c4 6 12 6 16 0" stroke="#B5673F" strokeWidth={2} strokeLinecap="round" />

      {/* qo'llari */}
      <circle cx="104" cy="160" r="9" fill="#FBD9B8" />
      <circle cx="136" cy="160" r="9" fill="#FBD9B8" />

      {/* shisha */}
      <rect x="108" y="128" width="24" height="46" rx="6" fill="#EAF2FF" stroke="#BFD6F5" strokeWidth={1.5} />
      <rect x="112" y="118" width="16" height="14" rx="4" fill="#F49CB8" />
      <ellipse cx="120" cy="108" rx="7" ry="6" fill="#F7D774" />
      <rect x="112" y="140" width="16" height="4" rx="2" fill="#BFD6F5" />
      <rect x="112" y="150" width="16" height="4" rx="2" fill="#BFD6F5" />
      <rect x="112" y="160" width="16" height="4" rx="2" fill="#BFD6F5" />
    </svg>
  );
}

/**
 * Rasmdagi karta: och kulrang fon ichida chaqaloq illyustratsiyasi va
 * pastda "Qayta boshlash" tugmasi. `onRestart` berilmasa, tugma oddiy
 * ko'rinishda qoladi (masalan, forma sifatida ishlatilganda).
 */
export function RestartCard({
  buttonLabel = "Qayta boshlash",
  onRestart,
  className,
}: {
  buttonLabel?: string;
  onRestart?: () => void;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-6 ${className ?? ""}`}>
      <div className="flex w-full max-w-sm items-center justify-center rounded-[28px] bg-[var(--color-surface-sunken)] px-8 py-10">
        <BabyBottleIllustration className="h-40 w-40" />
      </div>
      <button
        type="button"
        onClick={onRestart}
        className="rounded-full bg-rose-200 px-8 py-3 text-[15px] font-semibold text-rose-900 transition hover:bg-rose-300"
      >
        {buttonLabel}
      </button>
    </div>
  );
}
