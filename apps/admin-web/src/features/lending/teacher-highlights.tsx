"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, assetUrl } from "@/lib/api";
import type { LandingContentBlock } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { CameraIcon, DocumentIcon } from "@/components/ui/icons";

const HIGHLIGHT_BLOCKS: { key: string; label: string }[] = [
  { key: "maxsus-oqituvchi-1", label: "1-blok" },
  { key: "maxsus-oqituvchi-2", label: "2-blok" },
];

/**
 * "O'qituvchilar" sahifasining pastki qismida ikkita yumaloq rasmli blok bor
 * (landing-web'dagi TeacherSubjectHighlights) — istalgan xodimning rasmi va
 * matnini shu yerdan kiritish mumkin. LandingContentBlock modelidan
 * foydalanadi (ContentBlocksTab, platform-web bilan bir xil andoza).
 */
export function TeacherHighlightsSection({ canWrite }: { canWrite: boolean }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landing-content-blocks"],
    queryFn: () => api.get<LandingContentBlock[]>("/app/landing/content-blocks"),
  });

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-[16px] font-semibold text-[var(--color-text)]">Maxsus ko&apos;rsatilgan o&apos;qituvchilar</h2>
        <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
          &quot;O&apos;qituvchilar&quot; sahifasining pastki qismidagi ikkita yumaloq rasmli blok — istalgan xodimning rasmi va matnini shu yerga kiriting
        </p>
      </div>

      {isLoading ? (
        <LoadingState rows={2} />
      ) : isError ? (
        <ErrorState message={error instanceof ApiError ? error.message : "Xatolik yuz berdi"} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {HIGHLIGHT_BLOCKS.map(({ key, label }) => (
            <HighlightCard
              key={key}
              blockKey={key}
              label={label}
              canWrite={canWrite}
              existing={data?.find((b) => b.key === key) ?? null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const schema = z.object({
  title: z.string().min(2, "Sarlavha kamida 2 belgi"),
  body: z.string().min(2, "Matn kamida 2 belgi"),
});
type FormValues = z.infer<typeof schema>;

function HighlightCard({
  blockKey,
  label,
  canWrite,
  existing,
}: {
  blockKey: string;
  label: string;
  canWrite: boolean;
  existing: LandingContentBlock | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { title: existing?.title ?? "", body: existing?.body ?? "" },
  });

  useEffect(() => {
    reset({ title: existing?.title ?? "", body: existing?.body ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat serverdan kelgan qiymat o'zgarganda qayta to'ldiriladi
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch<LandingContentBlock>(`/app/landing/content-blocks/${blockKey}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-content-blocks"] });
      setServerError(null);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => api.upload<LandingContentBlock>(`/app/landing/content-blocks/${blockKey}/photo`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing-content-blocks"] }),
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Rasm yuklashda xatolik"),
  });

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center gap-2.5">
        <DocumentIcon className="h-4 w-4 text-[var(--color-text-subtle)]" />
        <p className="text-[14px] font-semibold text-[var(--color-text)]">{label}</p>
      </div>

      {serverError && (
        <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
          {serverError}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
          {existing?.photoPath ? (
            // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
            <img src={assetUrl(existing.photoPath) ?? undefined} alt={existing.title} className="h-full w-full object-cover" />
          ) : (
            <DocumentIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
          )}
        </div>
        {canWrite && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) photoMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <Button type="button" size="sm" variant="outline" loading={photoMutation.isPending} onClick={() => fileInputRef.current?.click()}>
              <CameraIcon className="h-4 w-4" />
              Rasm yuklash
            </Button>
          </>
        )}
      </div>

      {canWrite ? (
        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <Input label="Sarlavha" placeholder="Masalan: Ingliz tili o'qituvchisi" error={errors.title?.message} {...register("title")} />
          <Textarea
            label="Matn"
            rows={4}
            placeholder="Ushbu o'qituvchi haqida qisqacha matn"
            error={errors.body?.message}
            {...register("body")}
          />
          <div className="flex justify-end pt-1">
            <Button type="submit" size="sm" loading={isSubmitting || mutation.isPending} disabled={!isDirty}>
              Saqlash
            </Button>
          </div>
        </form>
      ) : (
        <div className="space-y-1">
          <p className="text-[14px] font-semibold text-[var(--color-text)]">{existing?.title || "Hali kiritilmagan"}</p>
          {existing?.body && <p className="text-[13px] text-[var(--color-text-muted)]">{existing.body}</p>}
        </div>
      )}
    </Card>
  );
}
