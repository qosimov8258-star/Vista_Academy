"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, PublicOrganization } from "@/lib/types";
import { KindergartenScene } from "@/components/brand/kindergarten-scene";
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
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em] text-[var(--p-muted)]">
            Ota-ona kabineti
          </p>
          <h1 className="mt-1.5 text-[26px] font-bold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">
            Assalomu alaykum!
          </h1>
          <p className="mt-1.5 text-[15px] leading-relaxed text-[var(--p-muted)]">
            Bolangizning bugungi kuni — davomati, ovqati va mashg&apos;ulotlari shu yerda.
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
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Bog'cha bergan parol"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 w-full rounded-[18px] border-2 border-[var(--p-line)] bg-[#fffdfa] px-4 text-[17px] text-[var(--p-ink)] outline-none transition-colors placeholder:text-[var(--p-muted)]/60 focus:border-[var(--p-sun)]"
              />
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
