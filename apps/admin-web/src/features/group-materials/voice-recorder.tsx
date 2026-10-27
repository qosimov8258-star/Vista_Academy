"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTr } from "@/i18n/tr";

/** Bitta ovozli xabarning eng uzun vaqti — undan keyin yozish o'zi to'xtaydi */
const MAX_SECONDS = 10 * 60;

/**
 * Yozish formati: avval mp4 (AAC) — davomiyligi faylga yoziladi va iPhone'da
 * ham ijro etiladi; Chrome'ning webm yozuvida davomiylik yo'q (pleyer "∞"
 * ko'rsatadi), shuning uchun webm faqat mp4 bo'lmagan brauzerda (Firefox).
 */
function pickMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/aac"]) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * "Ovoz yozish" — tarbiyachi telefonda vazifani ovoz bilan aytib beradi.
 * Yozib bo'lgach tayyor faylni `onRecorded` ga beradi (sahifa uni oddiy
 * yuklangan fayl kabi tinglatib, ota-onalarga yuboradi).
 */
export function VoiceRecorder({ onRecorded, onError }: { onRecorded: (file: File) => void; onError: (message: string | null) => void }) {
  const tr = useTr();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const release = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };
  // Sahifadan chiqib ketilsa mikrofon yoniq qolib ketmasin
  useEffect(() => release, []);

  const start = async () => {
    onError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      onError(tr("Bu brauzer ovoz yozishni qo'llamaydi — audio faylni «Fayl tanlash» orqali yuklang"));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError(tr("Mikrofonga ruxsat berilmadi — brauzer sozlamalarida mikrofonga ruxsat bering"));
      return;
    }
    const mimeType = pickMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    chunksRef.current = [];
    cancelledRef.current = false;
    recorder.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const type = (recorder.mimeType || mimeType || "audio/webm").split(";")[0];
      release();
      setRecording(false);
      if (cancelledRef.current || chunksRef.current.length === 0) return;
      const blob = new Blob(chunksRef.current, { type });
      const ext = type.includes("mp4") || type.includes("aac") ? "m4a" : "webm";
      const now = new Date();
      const stamp = `${now.getDate()}.${String(now.getMonth() + 1).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}`;
      onRecorded(new File([blob], `${tr("Ovozli vazifa")} ${stamp}.${ext}`, { type }));
    };
    streamRef.current = stream;
    recorderRef.current = recorder;
    recorder.start(1000);
    setSeconds(0);
    setRecording(true);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= MAX_SECONDS) recorderRef.current?.state === "recording" && recorderRef.current.stop();
        return s + 1;
      });
    }, 1000);
  };

  const stop = (cancel = false) => {
    cancelledRef.current = cancel;
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
    else {
      release();
      setRecording(false);
    }
  };

  if (!recording) {
    return (
      <Button variant="secondary" onClick={start}>
        <Mic className="h-4 w-4" /> {tr("Ovoz yozish")}
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-[var(--radius-lg)] bg-[#ff3b30]/[0.08] px-4 py-3" role="status" aria-live="polite">
      <span className="relative flex h-3 w-3" aria-hidden="true">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff3b30] opacity-60" />
        <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ff3b30]" />
      </span>
      <span className="text-[15px] font-semibold tabular-nums text-[#d70015]">
        {tr("Yozilmoqda")} {clock(seconds)}
      </span>
      <span className="ml-auto flex gap-2">
        <Button variant="secondary" size="sm" onClick={() => stop(true)}>
          {tr("Bekor qilish")}
        </Button>
        <Button size="sm" onClick={() => stop(false)}>
          <Square className="h-3.5 w-3.5" fill="currentColor" /> {tr("To'xtatish")}
        </Button>
      </span>
    </div>
  );
}
