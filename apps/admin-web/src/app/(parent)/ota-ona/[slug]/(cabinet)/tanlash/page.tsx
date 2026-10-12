"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";
import { initials } from "@/components/ui/avatar";
import { useTr } from "@/i18n/tr";
import { useSelectedChild } from "../use-selected-child";

/** "Farzandni tanlang" — ikki va undan ko'p bola bog'langan ota-ona uchun. */
export default function ChooseChildPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const router = useRouter();

  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  const children = meQuery.data?.children;
  const { select } = useSelectedChild(slug, children);

  useEffect(() => {
    if (meQuery.isError && meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      router.replace(`/ota-ona/${slug}/kirish`);
    }
  }, [meQuery.isError, meQuery.error, router, slug]);

  // Bitta bola bo'lsa tanlashning keragi yo'q
  useEffect(() => {
    if (children && children.length === 1) router.replace(`/ota-ona/${slug}`);
  }, [children, router, slug]);

  if (!children) {
    return (
      <div className="flex min-h-[60dvh] items-center justify-center">
        <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-[var(--p-coral)] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      <h1 className="text-[24px] font-bold tracking-[-0.02em] text-[var(--p-ink)]">{tr("Farzandni tanlang")}</h1>
      <div className="mt-5 space-y-3">
        {children.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              select(c.id);
              router.push(`/ota-ona/${slug}`);
            }}
            className="flex w-full cursor-pointer items-center gap-4 rounded-[var(--p-radius)] bg-[var(--p-card)] p-4 text-left shadow-[var(--p-shadow)]"
          >
            {c.avatarUpdatedAt ? (
              // eslint-disable-next-line @next/next/no-img-element -- tashqi manzil
              <img
                src={`${PARENT_API_URL}/app/parent/children/${c.id}/avatar?v=${encodeURIComponent(c.avatarUpdatedAt)}`}
                alt={tr(c.fullName)}
                className="h-14 w-14 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[var(--p-sun)]/20 text-[18px] font-bold text-[var(--p-sun-ink)]">
                {initials(c.fullName)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[17px] font-bold text-[var(--p-ink)]">{tr(c.fullName)}</span>
              <span className="block truncate text-[14px] text-[var(--p-muted)]">
                {c.group ? tr(c.group.name) : tr("Guruhsiz")}
              </span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
