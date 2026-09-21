"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, assetUrl } from "@/lib/api";
import type { LandingContentBlock } from "@/lib/types";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/states";
import { CameraIcon, DocumentIcon } from "@/components/ui/icons";

const BLOCKS: { key: string; label: string }[] = [
  { key: "doimiy-tarbiyachi", label: "Doimiy tarbiyachi" },
  { key: "talim-yonalishi", label: "Ta'lim yo'nalishi" },
];

export function ContentBlocksTab() {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landing", "content-blocks"],
    queryFn: () => api.get<LandingContentBlock[]>("/platform/landing/content-blocks"),
  });

  if (isLoading) return <LoadingState label="Yuklanmoqda..." />;
  if (isError) return <ErrorState message={(error as Error).message} />;

  return (
    <div className="space-y-4">
      <p className="text-[13px] text-[var(--color-text-muted)]">
        "Guruhlarimiz" menyusidagi matnli bo'limlar — sarlavha, matn va (ixtiyoriy) rasm.
      </p>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {BLOCKS.map(({ key, label }) => (
          <ContentBlockCard key={key} blockKey={key} label={label} existing={data?.find((b) => b.key === key) ?? null} />
        ))}
      </div>
    </div>
  );
}

const schema = z.object({
  title: z.string().min(2, "Sarlavha kamida 2 belgi"),
  body: z.string().min(2, "Matn kamida 2 belgi"),
});
type FormValues = z.infer<typeof schema>;

function ContentBlockCard({
  blockKey,
  label,
  existing,
}: {
  blockKey: string;
  label: string;
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
    defaultValues: { title: existing?.title ?? label, body: existing?.body ?? "" },
  });

  useEffect(() => {
    reset({ title: existing?.title ?? label, body: existing?.body ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat serverdan kelgan qiymat o'zgarganda qayta to'ldiriladi
  }, [existing]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch<LandingContentBlock>(`/platform/landing/content-blocks/${blockKey}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing", "content-blocks"] });
      setServerError(null);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => api.upload<LandingContentBlock>(`/platform/landing/content-blocks/${blockKey}/photo`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing", "content-blocks"] }),
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Rasm yuklashda xatolik"),
  });

  return (
    <Card>
      <CardHeader className="flex items-center gap-2.5">
        <DocumentIcon className="h-4 w-4 text-[var(--color-text-subtle)]" />
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)]">
            {existing?.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
              <img src={assetUrl(existing.photoPath) ?? undefined} alt={label} className="h-full w-full object-cover" />
            ) : (
              <DocumentIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
            )}
          </div>
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
        </div>

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <Input label="Sarlavha" error={errors.title?.message} {...register("title")} />
          <Textarea label="Matn" rows={5} error={errors.body?.message} {...register("body")} />
          <div className="flex justify-end pt-1">
            <Button type="submit" size="sm" loading={isSubmitting || mutation.isPending} disabled={!isDirty}>
              Saqlash
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
