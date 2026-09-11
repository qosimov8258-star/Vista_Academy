"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";
import { LogoutIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";
import { CardFx } from "../card-fx";
import { useSky } from "../use-sky";

/**
 * Sozlamalar. Hozircha bitta ish qiladi — kabinetdan chiqish.
 *
 * Chiqish tugmasi ilgari bosh sahifaning tepasida turardi: ota-ona uni
 * kunda bir marta ham bosmaydi, ammo bolasining kartochkasi yonida doim
 * ko'rinib turardi. Uning o'rni shu yer.
 */
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
  const firstChild = meQuery.data?.children[0];
  const sky = useSky(firstChild?.branch.address, firstChild?.branch.name);

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
                className="flex-1 cursor-pointer rounded-full bg-black/[0.05] py-3 text-[15px] font-bold text-[var(--p-ink)] transition-colors active:bg-black/[0.09]"
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
            className="flex w-full cursor-pointer items-center gap-3.5 px-5 py-4 text-left transition-colors active:bg-black/[0.03]"
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
      <section className="mt-3 rounded-[var(--p-radius)] bg-white/60 px-5 py-4">
        <span className="inline-flex items-center rounded-full bg-[var(--p-sun)]/18 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-[#a8720a]">
          Tez orada
        </span>
        <p className="mt-2.5 text-[14px] leading-relaxed text-[var(--p-muted)]">
          Parolni almashtirish, bildirishnomalar va aloqa ma&apos;lumotlari shu yerda bo&apos;ladi.
        </p>
      </section>
    </div>
  );
}
