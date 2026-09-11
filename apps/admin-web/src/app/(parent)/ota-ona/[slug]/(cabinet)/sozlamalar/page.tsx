"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";
import { LogoutIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";
import clsx from "clsx";
import { CardFx } from "../card-fx";
import { useCabinetTheme, type ThemeMode } from "../theme";

/**
 * Sozlamalar. Hozircha bitta ish qiladi — kabinetdan chiqish.
 *
 * Chiqish tugmasi ilgari bosh sahifaning tepasida turardi: ota-ona uni
 * kunda bir marta ham bosmaydi, ammo bolasining kartochkasi yonida doim
 * ko'rinib turardi. Uning o'rni shu yer.
 */
/** Telefonning o'z vaqt mintaqasida: ota-ona qayerda bo'lsa, o'sha soat */
function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString("uz-UZ", { hour: "2-digit", minute: "2-digit" });
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
    </svg>
  );
}

/** Yarmi quyosh, yarmi oy — o'zi almashadi */
function AutoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="7" />
      <path d="M12 5a7 7 0 0 1 0 14z" fill="currentColor" stroke="none" />
    </svg>
  );
}

const THEME_OPTIONS: Array<{ mode: ThemeMode; label: string; Icon: (props: { className?: string }) => React.JSX.Element }> = [
  { mode: "avto", label: "Avtomatik", Icon: AutoIcon },
  { mode: "yorug", label: "Yorug'", Icon: SunIcon },
  { mode: "qorongi", label: "Qorong'i", Icon: MoonIcon },
];

export default function ParentSettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  const parent = meQuery.data?.parent;
  const { mode, setMode, dark, sky } = useCabinetTheme();

  const logout = async () => {
    setLeaving(true);
    await parentApi.post("/app/parent/logout").catch(() => undefined);
    router.replace(`/ota-ona/${slug}/kirish`);
  };

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      <h1 className="text-[26px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--p-ink)]">
        Sozlamalar
      </h1>

      {parent && (
        <section className={`${styles.childCard} mt-4 rounded-[var(--p-radius)] p-5 shadow-[var(--p-shadow)]`}>
          <CardFx sky={sky} />
          <p className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--p-muted)]">
            Kabinet egasi
          </p>
          <p className="mt-1 text-[19px] font-bold tracking-[-0.01em] text-[var(--p-ink)]">{parent.fullName}</p>
          <p className="mt-0.5 text-[15px] tabular-nums text-[var(--p-muted)]">{parent.phone}</p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-[var(--p-muted)]">
            Shu raqam — kabinetning logini. Ota va ona bitta kabinetdan foydalanadi.
          </p>
        </section>
      )}

      {/* Ko'rinish: avto (quyosh botganda qorong'i), yorug', qorong'i */}
      <section className="mt-3 rounded-[var(--p-radius)] bg-[var(--p-card)] p-5 shadow-[var(--p-shadow)]">
        <p className="text-[15.5px] font-bold text-[var(--p-ink)]">Ko&apos;rinish</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--p-muted)]">
          Avtomatik rejimda quyosh botganda qorong&apos;i ko&apos;rinish o&apos;zi yonadi, tongda o&apos;chadi.
        </p>
        <div className="mt-3.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Ko'rinish">
          {THEME_OPTIONS.map((option) => {
            const active = option.mode === mode;
            return (
              <button
                key={option.mode}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setMode(option.mode)}
                className={clsx(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-[18px] border-2 px-2 py-3 text-[13px] font-bold transition-colors",
                  active
                    ? "border-[var(--p-sun)] bg-[var(--p-sun)]/14 text-[var(--p-sun-ink)]"
                    : "border-[var(--p-line)] text-[var(--p-muted)] active:bg-[var(--p-sunken)]",
                )}
              >
                <option.Icon className="h-6 w-6" />
                {option.label}
              </button>
            );
          })}
        </div>
        {mode === "avto" && sky && (
          <p className="mt-3 text-[12.5px] text-[var(--p-muted)]">
            {dark
              ? `Hozir tun — qorong'i ko'rinish yoqilgan${sky.sunrise ? `, tong ${clock(sky.sunrise)} da yorishadi` : ""}.`
              : `Hozir kunduz — qorong'i ko'rinish quyosh botganda${sky.sunset ? ` (${clock(sky.sunset)})` : ""} yonadi.`}
          </p>
        )}
      </section>

      {/* Chiqish */}
      <section className="mt-3 overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
        {confirming ? (
          <div className="p-5">
            <p className="text-[15.5px] font-semibold text-[var(--p-ink)]">Kabinetdan chiqasizmi?</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--p-muted)]">
              Keyingi safar telefon raqamingiz va parolingiz bilan qayta kirasiz.
            </p>
            <div className="mt-4 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="flex-1 cursor-pointer rounded-full bg-[var(--p-sunken)] py-3 text-[15px] font-bold text-[var(--p-ink)] transition-colors active:bg-[var(--p-sunken)]"
              >
                Qolaman
              </button>
              <button
                type="button"
                onClick={logout}
                disabled={leaving}
                className="flex-1 cursor-pointer rounded-full bg-[var(--p-coral)] py-3 text-[15px] font-bold text-white transition-opacity active:opacity-90 disabled:opacity-60"
              >
                {leaving ? "Chiqilmoqda…" : "Chiqaman"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex w-full cursor-pointer items-center gap-3.5 px-5 py-4 text-left transition-colors active:bg-[var(--p-sunken)]"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--p-coral)]/12 text-[var(--p-coral)]">
              <LogoutIcon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-bold text-[var(--p-ink)]">Kabinetdan chiqish</span>
              <span className="block text-[13px] text-[var(--p-muted)]">Telefoningizda boshqa hech kim ko&apos;rmaydi</span>
            </span>
          </button>
        )}
      </section>

      {/* Hali tayyor bo'lmagan qismlar — bo'sh sahifa qoldirmaymiz */}
      <section className="mt-3 rounded-[var(--p-radius)] bg-[var(--p-card)]/60 px-5 py-4">
        <span className="inline-flex items-center rounded-full bg-[var(--p-sun)]/18 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--p-sun-ink)]">
          Tez orada
        </span>
        <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--p-muted)]">
          Parolni almashtirish, bildirishnomalar va aloqa ma&apos;lumotlari shu yerda bo&apos;ladi.
        </p>
      </section>
    </div>
  );
}
