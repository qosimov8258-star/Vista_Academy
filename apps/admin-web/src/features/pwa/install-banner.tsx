"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { AppWindow, Check, Download, MousePointerClick, Share, SquarePlus, type LucideIcon } from "lucide-react";
import { IosSheet } from "@/components/ios/sheet";
import { detectPlatform, isStandalone, pwaInstalledKey, type PwaApp } from "@/lib/pwa";
import { isTenantEntrySession } from "@/lib/tenant-session";
import { isParentEntrySession } from "@/lib/parent-entry";
import { useTr } from "@/i18n/tr";

type Mode =
  | { kind: "none" }
  /** Chrome/Edge/Samsung: brauzerning o'z «O'rnatish» oynasi */
  | { kind: "prompt"; mobile: boolean }
  /** iPhone/iPad: avtomatik o'rnatib bo'lmaydi — ko'rsatma oynasi */
  | { kind: "ios"; browser: "safari" | "chrome" | "edge" }
  /** macOS Safari 17+: «Fayl → Dock'ga qo'shish» ko'rsatmasi */
  | { kind: "mac" };

function rememberInstalled(slug: string, app: PwaApp) {
  try {
    localStorage.setItem(pwaInstalledKey(slug, app), "1");
  } catch {
    /* maxfiy rejim — keyingi safar yana tekshiriladi */
  }
}

function wasInstalled(slug: string, app: PwaApp): boolean {
  try {
    return localStorage.getItem(pwaInstalledKey(slug, app)) === "1";
  } catch {
    return false;
  }
}

/**
 * Bosh sahifadagi «Ilovani o'rnating» qatori (xodimlar paneli va ota-ona
 * kabineti). Hech narsani to'smaydi va yopish tugmasi yo'q — ilova
 * o'rnatilgach o'zi yo'qoladi. Chiqmaydi: ilovaning o'zida ochilganda,
 * shu brauzerda o'rnatilgan bo'lsa, «mehmon» kirishda (platforma operatori,
 * «Xodim profiliga kirish») va o'rnatib bo'lmaydigan brauzerda (Firefox,
 * Telegram ichidagi brauzer...).
 */
export function InstallBanner({ slug, app, className }: { slug: string; app: PwaApp; className?: string }) {
  const tr = useTr();
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (app === "staff" ? isTenantEntrySession() : isParentEntrySession()) return;
    if (wasInstalled(slug, app)) return;

    const done = () => {
      rememberInstalled(slug, app);
      setMode({ kind: "none" });
    };
    window.addEventListener("pwa-installed", done);
    const platform = detectPlatform();

    if (platform.kind === "ios") setMode({ kind: "ios", browser: platform.browser });
    else if (platform.kind === "mac-safari") setMode({ kind: "mac" });
    if (platform.kind !== "chromium") return () => window.removeEventListener("pwa-installed", done);

    // Chrome hodisani faqat o'rnatish mumkin bo'lsa yuboradi (o'rnatilgan bo'lsa — yo'q)
    const { mobile } = platform;
    const onPrompt = () => setMode({ kind: "prompt", mobile });
    if (window.__pwaPrompt) onPrompt();
    window.addEventListener("pwa-prompt", onPrompt);
    return () => {
      window.removeEventListener("pwa-installed", done);
      window.removeEventListener("pwa-prompt", onPrompt);
    };
  }, [slug, app]);

  if (mode.kind === "none") return null;

  const install = async () => {
    if (mode.kind !== "prompt") {
      setGuide(true);
      return;
    }
    const event = window.__pwaPrompt;
    if (!event || busy) return;
    setBusy(true);
    try {
      await event.prompt();
      const { outcome } = await event.userChoice;
      if (outcome === "accepted") rememberInstalled(slug, app);
    } catch {
      /* brauzer oynani ko'rsatmadi */
    } finally {
      // Hodisa bir martalik: o'rnatilsa — qator yo'qoladi; bekor qilinsa — keyingi kirishda yana chiqadi
      window.__pwaPrompt = null;
      setBusy(false);
      setMode({ kind: "none" });
    }
  };

  const parent = app === "parent";
  const mobile = mode.kind === "ios" || (mode.kind === "prompt" && mode.mobile);

  return (
    <>
      <div
        className={clsx(
          "flex items-center gap-3 p-3",
          parent ? "rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]" : "rounded-[18px] bg-white",
          className,
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- statik ikonka */}
        <img src="/_pwa/icon-192.png" alt="" className="h-11 w-11 shrink-0 rounded-[11px]" />
        <div className="min-w-0 flex-1">
          <p className={clsx("text-[15.5px] font-semibold leading-snug", parent ? "text-[var(--p-ink)]" : "text-[var(--color-text)]")}>
            {tr("Ilovani o'rnating")}
          </p>
          <p className={clsx("text-[13px] leading-snug", parent ? "text-[var(--p-muted)]" : "text-[#8e8e93]")}>
            {mobile ? tr("Bosh ekrandan bir bosishda ochiladi") : tr("Ish stolidan bir bosishda ochiladi")}
          </p>
        </div>
        <button
          type="button"
          onClick={install}
          disabled={busy}
          className="flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold text-white transition-transform active:scale-[0.96] disabled:opacity-70"
          style={{ background: parent ? "var(--p-coral)" : "var(--color-primary)" }}
        >
          {busy ? (
            <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : (
            <Download className="h-[18px] w-[18px]" strokeWidth={2.3} />
          )}
          {tr("O'rnatish")}
        </button>
      </div>

      {(mode.kind === "ios" || mode.kind === "mac") && (
        <IosSheet open={guide} onClose={() => setGuide(false)} title={tr("Ilovani o'rnatish")} cancelLabel="Yopish">
          {mode.kind === "ios" ? <IosSteps browser={mode.browser} /> : <MacSteps />}
        </IosSheet>
      )}
    </>
  );
}

/** iPhone/iPad: Apple avtomatik o'rnatishga ruxsat bermaydi — qadam-baqadam */
function IosSteps({ browser }: { browser: "safari" | "chrome" | "edge" }) {
  const tr = useTr();
  const shareStep =
    browser === "chrome"
      ? tr("Manzil satridagi «Ulashish» belgisini bosing")
      : browser === "edge"
        ? tr("Pastdagi «•••» menyusidan «Ulashish»ni bosing")
        : tr("Pastdagi «Ulashish» belgisini bosing (iPad'da — tepada; yoki «•••» → «Ulashish»)");
  return (
    <>
      <Steps
        items={[
          { icon: Share, tint: "#007aff", text: shareStep },
          { icon: SquarePlus, tint: "#8e8e93", text: tr("Ro'yxatdan «Bosh ekranga qo'shish»ni tanlang") },
          { icon: Check, tint: "#34c759", text: tr("Yuqoridagi «Qo'shish»ni bosing") },
          { icon: MousePointerClick, tint: "#ff9500", text: tr("Bosh ekrandagi ilova belgisidan oching va qaytadan kiring") },
        ]}
      />
      <p className="px-4 text-[13px] leading-snug text-[#8e8e93]">{tr("«Bosh ekranga qo'shish» ko'rinmasa — sahifani Safari'da oching.")}</p>
    </>
  );
}

/** macOS Safari 17+ */
function MacSteps() {
  const tr = useTr();
  return (
    <Steps
      items={[
        { icon: AppWindow, tint: "#8e8e93", text: tr("Ekran tepasidagi menyudan «Fayl» (File)ni oching") },
        { icon: SquarePlus, tint: "#007aff", text: tr("«Dock'ga qo'shish» (Add to Dock)ni tanlang va «Qo'shish»ni bosing") },
        { icon: MousePointerClick, tint: "#ff9500", text: tr("Dock'dagi ilova belgisidan oching") },
      ]}
    />
  );
}

/** Oq karta ichidagi qatorlar: chapda rangli plitka, o'ngda matn (iOS «inset grouped») */
function Steps({ items }: { items: Array<{ icon: LucideIcon; tint: string; text: string }> }) {
  return (
    <ol className="overflow-hidden rounded-[18px] bg-white">
      {items.map(({ icon: Icon, tint, text }, i) => (
        <li key={i} className="relative flex min-h-[52px] items-center gap-3 px-4 py-2.5">
          <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-white" style={{ background: tint }}>
            <Icon className="h-[17px] w-[17px]" strokeWidth={2.2} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-[15px] leading-snug text-[#1c1c1e]">{text}</span>
          {i > 0 && <span className="absolute left-[58px] right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
        </li>
      ))}
    </ol>
  );
}
