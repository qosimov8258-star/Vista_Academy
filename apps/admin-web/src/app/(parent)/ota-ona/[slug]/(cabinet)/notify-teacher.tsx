"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { CheckCircle2, ChevronDown, Send } from "lucide-react";
import { ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import { IosIcon } from "@/features/director/ios-icon";
import { useTr } from "@/i18n/tr";

const MINUTES = [10, 15, 20, 30, 45, 60];

type Mode = "departure" | "note";

/**
 * "Xabar berish" — ota-ona tarbiyachiga ikki xil xabar yuboradi:
 * yo'lga chiqqani (necha daqiqada yetib kelishi) va eslatma (dori, ukol...).
 *
 * Ko'rinishi — bosh sahifaning iOS uslubida: plitkali qator, bosilganda
 * ichida segment, kapsula tugmalar va ko'k asosiy tugma ochiladi.
 */
export function NotifyTeacher({ childId, departureEnabled = true }: { childId: string; departureEnabled?: boolean }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [modeChoice, setMode] = useState<Mode>("departure");
  // «Olib ketish» o'chirilgan bo'lsa faqat eslatma qoladi
  const mode: Mode = departureEnabled ? modeChoice : "note";
  const [minutes, setMinutes] = useState(20);
  const [text, setText] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: () =>
      mode === "departure"
        ? parentApi.post(`/app/parent/children/${childId}/departure`, { minutes })
        : parentApi.post(`/app/parent/children/${childId}/note`, { text: text.trim() }),
    onSuccess: () => {
      setDone(mode === "departure" ? "Tarbiyachiga xabar yuborildi" : "Eslatma tarbiyachiga yuborildi");
      setText("");
    },
  });

  const error = send.error instanceof ApiError ? send.error.message : send.error ? "Yuborib bo'lmadi" : null;
  const canSend = mode === "departure" || text.trim().length > 0;

  return (
    <section className="mt-4 rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => {
          setOpen((v) => !v);
          setDone(null);
          send.reset();
        }}
        className="flex min-h-[64px] w-full items-center gap-3 px-4 py-3 text-left"
      >
        <IosIcon icon={Send} tint="blue" size={40} />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-snug text-[var(--p-ink)]">{tr("Tarbiyachiga xabar berish")}</span>
          <span className="block truncate text-[13.5px] text-[var(--p-muted)]">
            {departureEnabled ? tr("Yo'lga chiqdim yoki eslatma") : tr("Eslatma yuborish")}
          </span>
        </span>
        <ChevronDown
          className={clsx("h-5 w-5 shrink-0 text-[#c7c7cc] transition-transform duration-200", open && "rotate-180")}
          strokeWidth={2.4}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="space-y-3.5 px-4 pb-4">
          {/* iOS segmenti */}
          {departureEnabled && (
            <div role="radiogroup" className="flex rounded-full bg-[#767680]/[0.12] p-[3px]">
              {(
                [
                  ["departure", "Yo'lga chiqdim"],
                  ["note", "Eslatma"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={mode === key}
                  onClick={() => {
                    setMode(key);
                    setDone(null);
                    send.reset();
                  }}
                  className={clsx(
                    "h-9 flex-1 rounded-full text-[14.5px] font-semibold transition-colors",
                    mode === key ? "bg-white text-[var(--p-ink)] shadow-sm" : "text-[var(--p-muted)]",
                  )}
                >
                  {tr(label)}
                </button>
              ))}
            </div>
          )}

          {mode === "departure" ? (
            <div>
              <p className="mb-2 px-1 text-[13px] font-medium text-[var(--p-muted)]">{tr("Necha daqiqada yetib borasiz?")}</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={minutes === m}
                    onClick={() => setMinutes(m)}
                    className={clsx(
                      "h-11 rounded-full text-[15px] font-semibold tabular-nums transition-colors",
                      minutes === m ? "bg-[#007aff] text-white" : "bg-[var(--p-sunken)] text-[var(--p-ink)]",
                    )}
                  >
                    {m} {tr("daqiqa")}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={500}
              rows={3}
              aria-label={tr("Eslatma")}
              placeholder={tr("Masalan: ertaga soat 12:00 da dori berish kerak")}
              className="w-full resize-none rounded-[14px] bg-[var(--p-sunken)] px-3.5 py-3 text-[16px] text-[var(--p-ink)] outline-none placeholder:text-[var(--p-muted)] focus:ring-2 focus:ring-[#007aff]/40"
            />
          )}

          {error && <p className="px-1 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
          {done && (
            <p className="flex items-center gap-1.5 px-1 text-[14px] font-semibold text-[#34c759]">
              <CheckCircle2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {tr(done)}
            </p>
          )}

          <button
            type="button"
            disabled={!canSend || send.isPending}
            onClick={() => {
              setDone(null);
              send.mutate();
            }}
            className="h-12 w-full rounded-full bg-[#007aff] text-[16px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-40"
          >
            {send.isPending ? "…" : mode === "departure" ? tr("Yo'lga chiqdim") : tr("Yuborish")}
          </button>
        </div>
      )}
    </section>
  );
}
