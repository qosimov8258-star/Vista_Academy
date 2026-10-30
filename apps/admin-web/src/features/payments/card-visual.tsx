import clsx from "clsx";

/** "8600123412341234" → "8600 1234 1234 1234" */
export function formatCardNumber(value: string): string {
  return value.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
}

/**
 * Bank kartasi ko'rinishi — ota-ona kabinetida ham, moliyachi sahifasida ham
 * bir xil. Ranglari mavzuga bog'liq emas (qorong'i/yorug' rejimda bir xil
 * qoladi), shuning uchun faqat o'z gradiyenti bilan chiziladi.
 */
export function CardVisual({
  cardNumber,
  holderName,
  bankName,
  className,
}: {
  cardNumber: string;
  holderName: string;
  bankName?: string | null;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "relative aspect-[1.586/1] w-full overflow-hidden rounded-[24px] p-5 text-white shadow-[0_18px_40px_-14px_rgba(20,40,32,0.55)]",
        "bg-[linear-gradient(135deg,#17352b_0%,#1f5a43_52%,#2f9e72_100%)]",
        className,
      )}
    >
      {/* Yumshoq yorug'lik dog'lari */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
      <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-8 h-48 w-48 rounded-full bg-white/[0.07]" />

      <div className="relative flex h-full flex-col justify-between">
        <div className="flex items-start justify-between gap-3">
          <span className="truncate text-[13.5px] font-semibold tracking-wide text-white/85">{bankName || "Bank kartasi"}</span>
          {/* Chip */}
          <span aria-hidden className="h-8 w-11 shrink-0 rounded-[8px] bg-[linear-gradient(135deg,#f6dc8b,#c9a24a)] opacity-95 shadow-inner" />
        </div>

        <p className="text-center text-[clamp(18px,6vw,25px)] font-semibold tabular-nums tracking-[0.1em] [text-shadow:0_1px_2px_rgba(0,0,0,0.25)]">
          {formatCardNumber(cardNumber)}
        </p>

        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-white/60">Karta egasi</p>
          <p className="truncate text-[14.5px] font-semibold uppercase tracking-wide">{holderName}</p>
        </div>
      </div>
    </div>
  );
}
