import { Suspense } from "react";
import { LoginForm } from "./login-form";

/**
 * Kirish sahifasi — oq-qora, minimal, animatsiyasiz fon:
 * ingichka chiziqli to'r va karta orqasidagi konsentrik aylanalar,
 * ikkalasi ham chetga qarab radial maska bilan yo'qoladi.
 */
export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#f7f7f8] px-4 py-10">
      {/* To'r — 56px qadamli 1px chiziqlar, markazdan chetga qarab yo'qoladi */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(17,17,19,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(17,17,19,0.06) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          backgroundPosition: "center center",
          maskImage: "radial-gradient(ellipse 70% 65% at 50% 50%, #000 30%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 65% at 50% 50%, #000 30%, transparent 100%)",
        }}
      />
      {/* Konsentrik aylanalar — karta orqasida, faqat kontur */}
      <svg
        aria-hidden
        viewBox="0 0 1000 1000"
        className="pointer-events-none absolute left-1/2 top-1/2 h-[1100px] w-[1100px] -translate-x-1/2 -translate-y-1/2"
        style={{
          maskImage: "radial-gradient(circle at 50% 50%, #000 35%, transparent 72%)",
          WebkitMaskImage: "radial-gradient(circle at 50% 50%, #000 35%, transparent 72%)",
        }}
      >
        {[170, 250, 330, 410, 490].map((r, i) => (
          <circle key={r} cx="500" cy="500" r={r} fill="none" stroke="#111113" strokeOpacity={0.09 - i * 0.012} strokeWidth="1" />
        ))}
        {/* Bitta to'q nuqta — kompozitsiyaga urg'u */}
        <circle cx={500 + 330 * Math.cos(-0.7)} cy={500 + 330 * Math.sin(-0.7)} r="5" fill="#111113" />
      </svg>

      <div className="relative w-full max-w-[380px]">
        <div className="mb-7 text-center">
          <h1 className="flex justify-center">
            {/* Rasmiy logotip (public/zeeron-logo.svg — harflar atrofi qirqilgan) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/zeeron-logo.svg" alt="Zeeron" width={176} height={41} className="h-[41px] w-auto" />
          </h1>
          <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">Platforma</p>
          <p className="mt-4 text-[14px] text-[var(--color-text-muted)]">Bog&apos;chalarni boshqarish paneliga kirish</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>

      <p className="absolute bottom-6 left-0 right-0 text-center text-[12px] text-[var(--color-text-subtle)]">
        © {new Date().getFullYear()} Zeeron
      </p>
    </div>
  );
}
