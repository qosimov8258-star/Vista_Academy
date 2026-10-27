"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Mic } from "lucide-react";
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

/** Ovoz to'lqini: ustun eni va oralig'i (px), yangi ustun qo'shilish tezligi (ms) */
const BAR_WIDTH = 3;
const BAR_STEP = 6;
const BAR_INTERVAL = 70;

const clock = (seconds: number) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * "Ovoz yozish" — tarbiyachi telefonda vazifani ovoz bilan aytib beradi.
 * Yozib bo'lgach tayyor faylni `onRecorded` ga beradi (sahifa uni oddiy
 * yuklangan fayl kabi tinglatib, ota-onalarga yuboradi).
 */
/** "Fayl tanlash" bilan bir xil katta plitka (Vazifa jo'natish sahifasida yonma-yon) */
export const TILE =
  "flex min-h-[104px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[18px] bg-white px-3 py-4 transition-transform active:scale-[0.97]";

export function VoiceRecorder({
  onRecorded,
  onError,
  onRecordingChange,
  className,
}: {
  onRecorded: (file: File) => void;
  onError: (message: string | null) => void;
  /** Yozish boshlandi/tugadi — sahifa shu payt "Fayl tanlash"ni yashiradi */
  onRecordingChange?: (recording: boolean) => void;
  className?: string;
}) {
  const tr = useTr();
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Jonli ovoz to'lqini: mikrofon -> AnalyserNode -> canvas'dagi suriluvchi ustunlar
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelsRef = useRef<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const release = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    analyserRef.current = null;
    audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
  };
  // Sahifadan chiqib ketilsa mikrofon yoniq qolib ketmasin
  useEffect(() => release, []);
  useEffect(() => onRecordingChange?.(recording), [recording, onRecordingChange]);

  // Yozish paytida to'lqinni chizish: har ~70ms da ovoz balandligidan bitta ustun,
  // yangisi o'ngda, eskilari chapga surilib xiralashadi (iPhone diktofonidagidek)
  useEffect(() => {
    if (!recording) return;
    let smooth = 0;
    const samples = new Uint8Array(2048);
    // Taymer (rAF emas) — ustunlar bir tekis qo'shilsin, sahifa fonda bo'lsa ham
    const draw = () => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const analyser = analyserRef.current;
      if (analyser) {
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < analyser.fftSize; i++) {
          const v = (samples[i] - 128) / 128;
          sum += v * v;
        }
        // Ildiz — nutqni ko'zga tabiiy ko'rsatadi; jimlikdagi shovqin pastdan kesiladi
        const level = Math.min(1, Math.max(0, (Math.sqrt(Math.sqrt(sum / analyser.fftSize)) - 0.08) * 2.2));
        smooth = Math.max(level, smooth * 0.55);
      }

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (canvas.width !== Math.round(width * dpr)) canvas.width = Math.round(width * dpr);
      if (canvas.height !== Math.round(height * dpr)) canvas.height = Math.round(height * dpr);
      const count = Math.floor(width / BAR_STEP);
      const levels = levelsRef.current;
      levels.push(smooth);
      if (levels.length > count) levels.splice(0, levels.length - count);

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      const mid = height / 2;
      for (let slot = 0; slot < count; slot++) {
        // O'ngdan chapga: slot 0 — eng yangisi
        const level = levels[levels.length - 1 - slot];
        const x = width - (slot + 1) * BAR_STEP + (BAR_STEP - BAR_WIDTH) / 2;
        if (level === undefined) {
          ctx.fillStyle = "#d1d1d6";
          ctx.fillRect(x, mid - 1, BAR_WIDTH, 2);
          continue;
        }
        const h = Math.max(BAR_WIDTH, level * (height - 4));
        ctx.globalAlpha = 0.25 + 0.75 * (1 - slot / count);
        ctx.fillStyle = "#ff3b30";
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, mid - h / 2, BAR_WIDTH, h, BAR_WIDTH / 2);
        else ctx.rect(x, mid - h / 2, BAR_WIDTH, h);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    };
    draw();
    const timer = setInterval(draw, BAR_INTERVAL);
    return () => clearInterval(timer);
  }, [recording]);

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
    // To'lqin uchun tahlilchi — bo'lmasa ham yozish ishlayveradi
    try {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const audioCtx = new AudioCtx();
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        void audioCtx.resume();
        audioCtxRef.current = audioCtx;
        analyserRef.current = analyser;
      }
    } catch {
      analyserRef.current = null;
    }
    levelsRef.current = [];
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
      <button type="button" onClick={start} className={clsx(TILE, className)}>
        <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: "#ff3b301f", color: "#ff3b30" }}>
          <Mic className="h-[22px] w-[22px]" strokeWidth={2.2} />
        </span>
        <span className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Ovoz yozish")}</span>
      </button>
    );
  }
  return (
    <div className={clsx("col-span-2 flex flex-col items-center gap-4 rounded-[18px] bg-white px-4 py-5", className)} role="status" aria-live="polite">
      <span className="flex items-center gap-2.5">
        <span className="relative flex h-3 w-3" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#ff3b30] opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-[#ff3b30]" />
        </span>
        <span className="text-[15px] font-medium text-[#d70015]">{tr("Yozilmoqda")}</span>
      </span>
      <canvas ref={canvasRef} className="h-14 w-full" aria-hidden="true" />
      <span className="text-[40px] font-light leading-none tabular-nums tracking-tight text-[var(--color-text)]">{clock(seconds)}</span>
      <span className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
        <button
          type="button"
          onClick={() => stop(true)}
          className="h-11 cursor-pointer justify-self-start whitespace-nowrap rounded-full bg-[#767680]/[0.12] px-4 text-[15px] font-medium text-[var(--color-text)] active:opacity-60"
        >
          {tr("Bekor qilish")}
        </button>
        {/* iOS diktofonidagidek: qizil doira ichida kvadrat — to'xtatish */}
        <button
          type="button"
          onClick={() => stop(false)}
          aria-label={tr("To'xtatish")}
          className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-full border-[3px] border-[#c7c7cc] transition-transform active:scale-95"
        >
          <span className="h-7 w-7 rounded-[6px] bg-[#ff3b30]" />
        </button>
      </span>
    </div>
  );
}
