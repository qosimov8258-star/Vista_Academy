import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageShell } from "@/components/page-shell";
import { GROUPS, getGroupBySlug } from "@/lib/groups";

function PhotoPlaceholderIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="5" y="9" width="38" height="30" rx="6" />
      <circle cx="17" cy="19" r="4" />
      <path d="M5 33l11-11 9 9 6-6 12 12" />
    </svg>
  );
}

export function generateStaticParams() {
  return GROUPS.map((group) => ({ slug: group.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const group = getGroupBySlug(slug);
  return { title: group ? `${group.name} — Vista Academy` : "Guruh — Vista Academy" };
}

export default async function GroupPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const group = getGroupBySlug(slug);
  if (!group) notFound();

  return (
    <PageShell
      eyebrow="Guruhlarimiz"
      title={group.name}
      description="Bizning quvnoq guruhlarimizdan biri — farzandingiz shu yerda do'stlar orttiradi va yangi narsalar o'rganadi."
      heroImage={
        group.photo
          ? { src: group.photo, alt: `${group.name} guruhi`, position: "50% 0%" }
          : {
              alt: `${group.name} guruhi`,
              background: group.color,
              placeholder: (
                <div className="flex flex-col items-center gap-3 text-white/80">
                  <PhotoPlaceholderIcon className="h-16 w-16" />
                  <span className="text-[13px] font-bold">Rasm tez orada qo&apos;shiladi</span>
                </div>
              ),
            }
      }
    >
      <p className="mx-auto max-w-[560px] text-center text-[15px] leading-relaxed text-[var(--color-text-muted)]">
        &quot;{group.name}&quot; guruhi haqida batafsil ma&apos;lumot — tarbiyachilar, kun tartibi va mashg&apos;ulotlar — tez orada shu yerda e&apos;lon qilinadi.
      </p>
    </PageShell>
  );
}
