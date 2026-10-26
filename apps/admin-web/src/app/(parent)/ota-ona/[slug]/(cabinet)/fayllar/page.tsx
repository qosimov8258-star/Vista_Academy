"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import { PARENT_API_URL, parentApi } from "@/lib/parent-api";
import type { ParentAccount, ParentChild } from "@/lib/types";
import { DocumentIcon } from "@/components/ui/icons";
import styles from "../../parent.module.css";
import { EmptyCard, ListSkeleton, LoadErrorCard } from "../foydali/ui";
import { ChildSwitcher } from "../child-switcher";
import { useSelectedChild } from "../use-selected-child";
import { useLocale } from "next-intl";
import { useTr } from "@/i18n/tr";

interface Material {
  id: string;
  title: string;
  description: string | null;
  kind: "IMAGE" | "VIDEO" | "DOCUMENT";
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdByName: string;
  createdAt: string;
}

const fileUrl = (id: string) => `${PARENT_API_URL}/app/parent/materials/${id}/file`;

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function extensionOf(name: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(name);
  return match ? match[1].toUpperCase() : "FILE";
}

/**
 * Fayllar — tarbiyachi/o'qituvchi bolaning guruhiga yuklagan rasm, video va
 * hujjatlar. Faqat o'qish; yuklash tomoni: admin-web `/materials`.
 */
export default function ParentMaterialsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const locale = useLocale();
  const { slug } = use(params);
  const router = useRouter();

  const meQuery = useQuery({
    queryKey: ["parent-me", slug],
    queryFn: () => parentApi.get<{ parent: ParentAccount; children: ParentChild[] }>("/app/parent/me"),
    retry: false,
  });
  useEffect(() => {
    if (meQuery.isError && meQuery.error instanceof ApiError && meQuery.error.status === 401) {
      router.replace(`/ota-ona/${slug}/kirish`);
    }
  }, [meQuery.isError, meQuery.error, router, slug]);

  const { child, childId, multiple } = useSelectedChild(slug, meQuery.data?.children);
  const materialsQuery = useQuery({
    queryKey: ["parent-materials", childId],
    queryFn: () => parentApi.get<Material[]>(`/app/parent/children/${childId}/materials`),
    enabled: !!childId,
    retry: false,
    refetchOnWindowFocus: true,
  });
  const items = materialsQuery.data;

  return (
    <div className="mx-auto w-full max-w-[520px] px-4 pt-5">
      <header>
        <h1 className={`${styles.roundedFont} text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-[var(--p-ink)]`}>
          {tr("Fayllar")}
        </h1>
        <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--p-muted)]">
          {tr("Tarbiyachi guruhga yuklagan rasm, video va hujjatlar")}
        </p>
      </header>

      {multiple && child && <ChildSwitcher slug={slug} child={child} />}

      {!items ? (
        materialsQuery.isError || meQuery.isError ? (
          <LoadErrorCard
            error={materialsQuery.error ?? meQuery.error}
            onRetry={() => {
              meQuery.refetch();
              materialsQuery.refetch();
            }}
            loginHref={`/ota-ona/${slug}/kirish`}
          />
        ) : (
          <ListSkeleton rows={4} />
        )
      ) : items.length === 0 ? (
        <EmptyCard
          Icon={DocumentIcon}
          tone="sun"
          title={tr("Hozircha fayl yo'q")}
          text={tr("Tarbiyachi guruhga rasm, video yoki hujjat yuklasa, shu yerda paydo bo'ladi.")}
        />
      ) : (
        <ul className="mt-5 space-y-3 pb-6">
          {items.map((item) => (
            <li key={item.id} className="overflow-hidden rounded-[var(--p-radius)] bg-[var(--p-card)] shadow-[var(--p-shadow)]">
              {item.kind === "IMAGE" && (
                <a href={fileUrl(item.id)} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={fileUrl(item.id)} alt={item.title} loading="lazy" className="max-h-[320px] w-full object-cover" />
                </a>
              )}
              {item.kind === "VIDEO" && (
                <video src={fileUrl(item.id)} controls preload="metadata" playsInline className="max-h-[320px] w-full bg-black" />
              )}
              <div className="flex items-start gap-3 p-4">
                {item.kind === "DOCUMENT" && (
                  <a
                    href={fileUrl(item.id)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={tr("Ochish")}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[var(--p-bg)] text-[11px] font-extrabold text-[var(--p-ink)]"
                  >
                    {extensionOf(item.originalName)}
                  </a>
                )}
                <div className="min-w-0 flex-1">
                  <p className="break-words text-[16px] font-bold leading-snug text-[var(--p-ink)]">{item.title}</p>
                  {item.description && (
                    <p className="mt-1 whitespace-pre-line break-words text-[14px] leading-relaxed text-[var(--p-muted)]">
                      {item.description}
                    </p>
                  )}
                  <p className="mt-1 text-[12.5px] text-[var(--p-muted)]">
                    {item.createdByName} · {new Date(item.createdAt).toLocaleDateString(locale === "uz" ? "uz-UZ" : locale === "ru" ? "ru-RU" : "en-GB")} · {sizeLabel(item.sizeBytes)}
                  </p>
                  {item.kind === "DOCUMENT" && (
                    <a
                      href={fileUrl(item.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-[14px] font-bold text-[var(--p-ink)] underline underline-offset-4"
                    >
                      {tr("Ochish")}
                    </a>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
