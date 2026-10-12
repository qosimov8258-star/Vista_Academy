"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import { useTr } from "@/i18n/tr";

const MINUTES = [10, 15, 20, 30, 45, 60];

type Mode = "departure" | "note";

/**
 * "Xabar berish" — ota-ona tarbiyachiga ikki xil xabar yuboradi:
 * yo'lga chiqqani (necha daqiqada yetib kelishi) va eslatma (dori, ukol...).
 */
export function NotifyTeacher({ childId }: { childId: string }) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("departure");
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
    <section className="mt-4 rounded-[var(--p-radius)] bg-[var(--p-card)] p-4 shadow-[var(--p-shadow)]">
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v);
          setDone(null);
          send.reset();
        }}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[15px] font-bold text-[var(--p-ink)]">{tr("Tarbiyachiga xabar berish")}</span>
        <span className="text-[var(--p-muted)]">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["departure", "Yo'lga chiqdim"],
                ["note", "Eslatma"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setMode(key);
                  setDone(null);
                  send.reset();
                }}
                className={clsx(
                  "rounded-[var(--p-radius)] px-3 py-2.5 text-[14px] font-bold",
                  mode === key
                    ? "bg-[var(--p-coral)] text-white"
                    : "bg-[var(--p-ink)]/8 text-[var(--p-ink)]",
                )}
              >
                {tr(label)}
              </button>
            ))}
          </div>

          {mode === "departure" ? (
            <div>
              <p className="mb-2 text-[13px] text-[var(--p-muted)]">{tr("Necha daqiqada yetib borasiz?")}</p>
              <div className="grid grid-cols-3 gap-2">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMinutes(m)}
                    className={clsx(
                      "rounded-[var(--p-radius)] px-2 py-2 text-[14px] font-bold",
                      minutes === m
                        ? "bg-[var(--p-mint)] text-white"
                        : "bg-[var(--p-ink)]/8 text-[var(--p-ink)]",
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
              placeholder={tr("Masalan: ertaga soat 12:00 da dori berish kerak")}
              className="w-full rounded-[var(--p-radius)] bg-[var(--p-ink)]/8 p-3 text-[15px] text-[var(--p-ink)] outline-none placeholder:text-[var(--p-muted)]"
            />
          )}

          {error && <p className="text-[13px] text-[var(--p-coral)]">{tr(error)}</p>}
          {done && <p className="text-[13px] font-bold text-[var(--p-mint)]">{tr(done)}</p>}

          <button
            type="button"
            disabled={!canSend || send.isPending}
            onClick={() => {
              setDone(null);
              send.mutate();
            }}
            className="w-full rounded-[var(--p-radius)] bg-[var(--p-coral)] py-3 text-[15px] font-bold text-white disabled:opacity-50"
          >
            {send.isPending ? "…" : mode === "departure" ? tr("Yo'lga chiqdim") : tr("Yuborish")}
          </button>
        </div>
      )}
    </section>
  );
}
