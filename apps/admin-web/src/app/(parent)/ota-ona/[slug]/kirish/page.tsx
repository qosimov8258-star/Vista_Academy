"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, PublicOrganization } from "@/lib/types";
import { KindergartenScene } from "@/components/brand/kindergarten-scene";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import styles from "../parent.module.css";

/**
 * Ota-ona kirishi. Login — bolaga biriktirilgan telefon raqami, parolni
 * bog'cha beradi. Ekranning yarmi rasm: ota-ona buni telefonda ochadi va
 * birinchi taassurot muhim.
 */
export default function ParentLoginPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const orgQuery = useQuery({
    queryKey: ["org-public", slug],
    queryFn: () => api.get<PublicOrganization>(`/app/organizations/by-slug/${encodeURIComponent(slug)}`),
    staleTime: 5 * 60 * 1000,
    retry: (count, err) => !(err instanceof ApiError && err.status === 404) && count < 1,
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await parentApi.post<{ parent: ParentAccount }>("/app/parent/login", { orgSlug: slug, phone, password });
      router.push(`/ota-ona/${slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`${styles.shell} ${styles.sky} flex min-h-[100dvh] flex-col`}>
      <div className="relative h-[34vh] min-h-[220px] overflow-hidden">
        <KindergartenScene name={orgQuery.data?.name ?? null} />
      </div>

      <div className="relative -mt-8 flex-1 rounded-t-[32px] bg-[var(--p-card)] px-5 pb-10 pt-7 shadow-[var(--p-shadow)] sm:mx-auto sm:w-full sm:max-w-[440px] sm:rounded-[var(--p-radius)]">
        <div className={styles.pop}>
          <div className={`${styles.greet} flex items-start gap-3.5`}>
            <SmilingSun />
            <div className="min-w-0 flex-1">
              <span className="inline-flex items-center rounded-full bg-[var(--p-sun)]/18 px-2.5 py-1 text-[11.5px] font-bold uppercase tracking-[0.07em] text-[#a8720a]">
                Ota-ona kabineti
              </span>
              <h1 className="mt-2 text-[30px] font-extrabold leading-[1.1] tracking-[-0.025em] text-[var(--p-ink)]">
                Assalomu
                <br />
                alaykum<span className="text-[var(--p-coral)]">!</span>
              </h1>
            </div>
          </div>
          <p className="mt-3.5 text-[15.5px] leading-relaxed text-[var(--p-muted)]">
            Bolangizning bugungi kuni — <b className="font-semibold text-[var(--p-ink)]">davomati</b>,{" "}
            <b className="font-semibold text-[var(--p-ink)]">ovqati</b> va{" "}
            <b className="font-semibold text-[var(--p-ink)]">mashg&apos;ulotlari</b> shu yerda.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && (
              <div
                role="alert"
                className="rounded-[16px] bg-[#ffeceb] px-4 py-3 text-[14px] font-medium text-[#c1372a]"
              >
                {error}
              </div>
            )}

            <label className="block">
              <span className="mb-2 block text-[14px] font-semibold text-[var(--p-ink)]">Telefon raqamingiz</span>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="+998 90 123 45 67"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-14 w-full rounded-[18px] border-2 border-[var(--p-line)] bg-[#fffdfa] px-4 text-[17px] text-[var(--p-ink)] outline-none transition-colors placeholder:text-[var(--p-muted)]/60 focus:border-[var(--p-sun)]"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[14px] font-semibold text-[var(--p-ink)]">Parol</span>
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Bog'cha bergan parol"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-14 w-full rounded-[18px] border-2 border-[var(--p-line)] bg-[#fffdfa] pl-4 pr-14 text-[17px] text-[var(--p-ink)] outline-none transition-colors placeholder:text-[var(--p-muted)]/60 focus:border-[var(--p-sun)]"
                />
                {/* Parolni ko'rish: bog'cha bergan parolni qo'lda terganda
                    xato yozilmaganini tekshirish uchun */}
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  aria-pressed={showPassword}
                  className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[var(--p-muted)] transition-colors active:bg-black/[0.05]"
                >
                  {showPassword ? <EyeOffIcon className="h-[22px] w-[22px]" /> : <EyeIcon className="h-[22px] w-[22px]" />}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={busy || !phone || !password}
              className="flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--p-coral)] text-[17px] font-bold text-white shadow-[0_2px_4px_rgba(255,122,102,0.3),0_10px_22px_-8px_rgba(255,122,102,0.6)] transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:active:scale-100"
            >
              {busy && <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              Kirish
            </button>
          </form>

          <p className="mt-6 text-center text-[13.5px] leading-relaxed text-[var(--p-muted)]">
            Parolni bilmasangiz yoki unutgan bo&apos;lsangiz — bog&apos;cha ma&apos;muriyatiga murojaat qiling.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Kulib turgan quyosh — kabinetning salomlashish belgisi. */
function SmilingSun() {
  const rays = Array.from({ length: 8 }, (_, i) => {
    const angle = ((i * 45 - 90) * Math.PI) / 180;
    const round = (v: number) => Math.round(v * 100) / 100;
    return {
      x1: round(32 + 21 * Math.cos(angle)),
      y1: round(32 + 21 * Math.sin(angle)),
      x2: round(32 + 28 * Math.cos(angle)),
      y2: round(32 + 28 * Math.sin(angle)),
    };
  });

  return (
    <svg viewBox="0 0 64 64" className="h-[58px] w-[58px] shrink-0" aria-hidden="true">
      <defs>
        <radialGradient id="parent-sun-glow">
          <stop offset="0" stopColor="#ffb703" stopOpacity="0.4" />
          <stop offset="1" stopColor="#ffb703" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle className={styles.sunGlow} cx="32" cy="32" r="31" fill="url(#parent-sun-glow)" />
      <g className={styles.sunRays} stroke="#ffb703" strokeWidth="3.4" strokeLinecap="round">
        {rays.map((r, i) => (
          <line key={i} x1={r.x1} y1={r.y1} x2={r.x2} y2={r.y2} />
        ))}
      </g>
      <circle cx="32" cy="32" r="17" fill="#ffc93c" />
      <circle cx="26.5" cy="29.5" r="2" fill="#8a5a00" />
      <circle cx="37.5" cy="29.5" r="2" fill="#8a5a00" />
      <circle cx="23" cy="35" r="2.6" fill="#ff8a7a" opacity="0.65" />
      <circle cx="41" cy="35" r="2.6" fill="#ff8a7a" opacity="0.65" />
      <path d="M26 36.5a6.4 6.4 0 0 0 12 0" stroke="#8a5a00" strokeWidth="2.4" fill="none" strokeLinecap="round" />
    </svg>
  );
}
