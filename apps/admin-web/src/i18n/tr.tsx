"use client";

import { createContext, useCallback, useContext, useEffect, useMemo } from "react";

type Dict = Record<string, string>;

type Pattern = { regex: RegExp; target: string };

const TrContext = createContext<Dict>({});

/**
 * Matn kalit sifatida o'zbekcha yozilgan holda saqlanadi; rus/ingliz tilida
 * `messages/dict.<til>.json` dan topiladi. Topilmasa — o'zbekcha matn qoladi.
 */
export function TrProvider({ dict, children }: { dict: Dict; children: React.ReactNode }) {
  return (
    <TrContext.Provider value={dict}>
      <DomTranslator />
      {children}
    </TrContext.Provider>
  );
}

const TRANSLATED_ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE", "PRE", "NOSCRIPT"]);

/**
 * Xavfsizlik to'ri: `tr()` bilan o'ralmay qolgan matnlar (masalan, doimiy
 * ro'yxatlardagi nomlar yoki serverdan kelgan xabarlar) lug'atda bo'lsa,
 * ekranda tarjima qilinadi. Faqat matn tuguni aynan lug'at kaliti bilan
 * mos kelganda almashtiriladi — foydalanuvchi kiritgan ma'lumotga tegmaydi.
 */
function DomTranslator() {
  const dict = useContext(TrContext);
  const tr = useTr();

  useEffect(() => {
    if (Object.keys(dict).length === 0) return;
    const done = new WeakMap<Node, string>();

    const translateText = (node: Text) => {
      const value = node.nodeValue ?? "";
      if (done.get(node) === value) return;
      const trimmed = value.trim();
      if (!trimmed) return;
      const next = tr(trimmed);
      if (next !== trimmed) {
        const lead = value.slice(0, value.indexOf(trimmed));
        const trail = value.slice(value.indexOf(trimmed) + trimmed.length);
        const result = lead + next + trail;
        done.set(node, result);
        node.nodeValue = result;
      }
    };

    const translateAttrs = (el: Element) => {
      for (const attr of TRANSLATED_ATTRS) {
        const value = el.getAttribute(attr);
        if (!value) continue;
        const next = tr(value.trim());
        if (next !== value.trim()) el.setAttribute(attr, next);
      }
    };

    const walk = (root: Node) => {
      if (root.nodeType === Node.TEXT_NODE) {
        if (root.parentElement && !SKIP_TAGS.has(root.parentElement.tagName)) translateText(root as Text);
        return;
      }
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      if (SKIP_TAGS.has(el.tagName) || el.closest("[contenteditable=true]")) return;
      translateAttrs(el);
      el.querySelectorAll("*").forEach((child) => {
        if (!SKIP_TAGS.has(child.tagName)) translateAttrs(child);
      });
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let n: Node | null;
      while ((n = walker.nextNode())) {
        if (n.parentElement && !SKIP_TAGS.has(n.parentElement.tagName)) translateText(n as Text);
      }
    };

    let frame = 0;
    const pending = new Set<Node>();
    const flush = () => {
      frame = 0;
      const nodes = [...pending];
      pending.clear();
      observer.disconnect();
      nodes.forEach((n) => n.isConnected && walk(n));
      observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TRANSLATED_ATTRS });
    };
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "childList") m.addedNodes.forEach((n) => pending.add(n));
        else pending.add(m.target);
      }
      if (!frame) frame = requestAnimationFrame(flush);
    });

    walk(document.body);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: TRANSLATED_ATTRS });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [dict, tr]);

  return null;
}

const escapeRegex = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, "\\$&");

export function useTr() {
  const dict = useContext(TrContext);
  // "Rasm juda katta ({0} MB)" kabi o'rin belgili kalitlar — tayyor (xato) matnni ham tarjima qilish uchun
  const patterns = useMemo<Pattern[]>(
    () =>
      Object.keys(dict)
        .filter((key) => /\{\d+\}/.test(key) && key.replace(/\{\d+\}/g, "").trim().length >= 4)
        .map((key) => ({
          regex: new RegExp("^" + escapeRegex(key).replace(/\{\d+\}/g, "(.+?)") + "$"),
          target: dict[key],
        })),
    [dict],
  );

  return useCallback(
    <T,>(text: T, ...args: unknown[]): T => {
      if (typeof text !== "string") return text;
      let translated = dict[text];
      if (translated === undefined && !args.length) {
        for (const { regex, target } of patterns) {
          const match = regex.exec(text);
          if (match) {
            translated = target.replace(/\{(\d+)\}/g, (_, i) => match[Number(i) + 1] ?? "");
            break;
          }
        }
      }
      translated ??= text;
      if (!args.length) return translated as unknown as T;
      // "Jami {0} ta" kabi o'rin belgilari: qiymatlar tarjimadan keyin joylanadi
      return translated.replace(/\{(\d+)\}/g, (_, i) => String(args[Number(i)] ?? "")) as unknown as T;
    },
    [dict, patterns],
  );
}
