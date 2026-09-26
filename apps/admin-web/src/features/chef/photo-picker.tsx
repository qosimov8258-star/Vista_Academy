"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CameraIcon, CloseIcon } from "@/components/ui/icons";

/** Telefon/planshet: barmoq bilan boshqariladigan ekran */
const isTouchDevice = () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;

/**
 * Surat olish manbai — kamera yoki galereya.
 *
 * Telefonda "kamera" telefonning o'z kamerasini ochadi (`capture`), u eng
 * qulay va tanish. Kompyuterda brauzer `capture`ni e'tiborsiz qoldirib
 * faqat fayl tanlash oynasini chiqaradi — shuning uchun u yerda kamera
 * sahifaning o'zida ochiladi (getUserMedia). Kamera bo'lmasa yoki ruxsat
 * berilmasa, galereyadan tanlash taklif qilinadi.
 */
export function usePhotoPicker() {
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);
  const callback = useRef<((file: File) => void) | null>(null);
  const [webcamOpen, setWebcamOpen] = useState(false);

  const deliver = useCallback((file: File | undefined) => {
    if (file && callback.current) callback.current(file);
  }, []);

  const openGallery = useCallback((onFile: (file: File) => void) => {
    callback.current = onFile;
    galleryInput.current?.click();
  }, []);

  const openCamera = useCallback((onFile: (file: File) => void) => {
    callback.current = onFile;
    const canStream = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    if (isTouchDevice() || !canStream) {
      cameraInput.current?.click();
    } else {
      setWebcamOpen(true);
    }
  }, []);

  const ui = (
    <>
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          deliver(file);
        }}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          deliver(file);
        }}
      />
      {webcamOpen && (
        <WebcamCapture
          onClose={() => setWebcamOpen(false)}
          onCapture={(file) => {
            setWebcamOpen(false);
            deliver(file);
          }}
          onGallery={() => {
            setWebcamOpen(false);
            galleryInput.current?.click();
          }}
        />
      )}
    </>
  );

  return { openCamera, openGallery, ui };
}

/** Sahifa ichidagi kamera: jonli tasvir → surat → ko'rib chiqish → yuklash */
function WebcamCapture({
  onClose,
  onCapture,
  onGallery,
}: {
  onClose: () => void;
  onCapture: (file: File) => void;
  onGallery: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<"starting" | "live" | "error">("starting");
  const [error, setError] = useState<string | null>(null);
  const [shot, setShot] = useState<{ url: string; file: File } | null>(null);
  // Ota komponent har yangilanganda (sahifa 15 soniyada so'rov yuboradi)
  // onClose yangi funksiya bo'ladi — kamera qayta ochilib-yopilmasligi uchun ref'da
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
        setStatus("live");
      })
      .catch((err: DOMException) => {
        if (cancelled) return;
        setStatus("error");
        setError(
          err?.name === "NotAllowedError"
            ? "Kameraga ruxsat berilmadi. Brauzer manzil satridagi kamera belgisidan ruxsat bering yoki galereyadan tanlang."
            : err?.name === "NotFoundError"
              ? "Bu qurilmada kamera topilmadi — galereyadan tanlang."
              : "Kamerani ochib bo'lmadi — galereyadan tanlang.",
        );
      });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCloseRef.current();
    window.addEventListener("keydown", onKey);
    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (!shot) return;
    return () => URL.revokeObjectURL(shot.url);
  }, [shot]);

  const takePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `taom-${Date.now()}.jpg`, { type: "image/jpeg" });
        setShot({ url: URL.createObjectURL(blob), file });
      },
      "image/jpeg",
      0.92,
    );
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Kamera">
      <div className="flex items-center justify-between px-4 pb-3" style={{ paddingTop: "max(14px, env(safe-area-inset-top))" }}>
        <p className="text-[15px] font-semibold">{shot ? "Surat yaxshi chiqdimi?" : "Taomni suratga oling"}</p>
        <button type="button" onClick={onClose} aria-label="Yopish" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 active:bg-white/25">
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        {/* Video doim joyida — "Qayta olish"da jonli tasvir darhol qaytadi */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={shot ? "hidden" : "max-h-full max-w-full rounded-2xl bg-white/5 object-contain"}
        />
        {shot && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shot.url} alt="Olingan surat" className="max-h-full max-w-full rounded-2xl object-contain" />
        )}
        {status === "starting" && !shot && <p className="absolute text-[14px] text-white/70">Kamera ochilmoqda…</p>}
        {status === "error" && (
          <div className="absolute inset-x-6 rounded-2xl bg-white/10 p-4 text-center">
            <p className="text-[14.5px] leading-snug">{error}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-4 px-4 pt-4" style={{ paddingBottom: "max(18px, env(safe-area-inset-bottom))" }}>
        {shot ? (
          <>
            <button
              type="button"
              onClick={() => setShot(null)}
              className="h-12 flex-1 rounded-2xl bg-white/15 text-[15px] font-semibold active:bg-white/25"
            >
              Qayta olish
            </button>
            <button
              type="button"
              onClick={() => onCapture(shot.file)}
              className="h-12 flex-[1.3] rounded-2xl bg-orange-500 text-[15px] font-semibold active:bg-orange-600"
            >
              Yuklash
            </button>
          </>
        ) : (
          <>
            <button type="button" onClick={onGallery} className="h-12 w-28 rounded-2xl bg-white/15 text-[14px] font-semibold active:bg-white/25">
              Galereya
            </button>
            <button
              type="button"
              onClick={takePhoto}
              disabled={status !== "live"}
              aria-label="Suratga olish"
              className="flex h-[74px] w-[74px] items-center justify-center rounded-full border-4 border-white/80 bg-orange-500 transition-transform active:scale-95 disabled:opacity-40"
            >
              <CameraIcon className="h-8 w-8" />
            </button>
            <span className="w-28" aria-hidden />
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
