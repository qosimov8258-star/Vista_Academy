"use client";

import { MandatoryMessageModal } from "@/features/broadcasts/mandatory-gate";
import { useAppPathname } from "@/lib/tenant-host-context";
import { useMarkParentMessageRead, useParentMessages } from "./use-messages";

const PALETTE = { sheet: "var(--p-bg)", card: "var(--p-card)", ink: "var(--p-ink)", muted: "var(--p-muted)", accent: "var(--p-coral)" };

/**
 * Majburiy xabar — «O'qidim» bosilmaguncha kabinetda yopilmaydigan oyna.
 * Kabinet qobig'ining ichida chiziladi (portal emas): ranglar va qorong'i
 * rejim tokenlari shu qobiqda.
 */
export function ParentMandatoryGate({ slug }: { slug: string }) {
  const pathname = useAppPathname();
  const messages = useParentMessages(slug);
  const read = useMarkParentMessageRead(slug);
  // Kirish sahifasi bu qobiqdan tashqarida, lekin ehtiyot uchun
  if (pathname.includes("/kirish") || !messages.data) return null;
  return (
    <MandatoryMessageModal
      messages={messages.data}
      onAcknowledge={(id) => read.mutate(id)}
      pendingId={read.isPending ? (read.variables ?? null) : null}
      palette={PALETTE}
      portal={false}
    />
  );
}
