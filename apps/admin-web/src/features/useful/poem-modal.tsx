"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Poem } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { splitIntoBlocks } from "./split-blocks";
import { useTr } from "@/i18n/tr";

const RECOMMENDED_LINE_LENGTH = 45;

function buildSchema(groupRequired: boolean) {
  return z
    .object({
      title: z.string().min(1, "Sarlavhani kiriting").max(80, "Ko'pi bilan 80 belgi"),
      author: z.string().max(80, "Ko'pi bilan 80 belgi").optional(),
      groupId: groupRequired ? z.string().min(1, "Guruhni tanlang") : z.string().optional(),
      ageFrom: z.coerce.number().int().min(2).max(7),
      ageTo: z.coerce.number().int().min(2).max(7),
      text: z.string().min(1, "Matnni kiriting").max(6000),
      status: z.enum(["PUBLISHED", "DRAFT"]),
    })
    .refine((v) => v.ageFrom <= v.ageTo, {
      message: "Boshlanishi tugashidan katta bo'lmasin",
      path: ["ageTo"],
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function PoemModal({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  poem,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  /** O'qituvchi uchun guruh tanlash majburiy, boshqalar "Butun filial"ni ham tanlay oladi. */
  isTeacher: boolean;
  poem?: Poem | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!poem;
  const schema = useMemo(() => buildSchema(isTeacher), [isTeacher]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      title: poem?.title ?? "",
      author: poem?.author ?? "",
      groupId: poem?.groupId ?? "",
      ageFrom: poem?.ageFrom ?? 3,
      ageTo: poem?.ageTo ?? 6,
      text: poem ? poem.stanzas.map((stanza) => stanza.join("\n")).join("\n\n") : "",
      status: poem?.status ?? "PUBLISHED",
    },
  });

  const text = watch("text") ?? "";
  const preview = useMemo(() => splitIntoBlocks(text), [text]);
  const hasLongLine = preview.some((stanza) => stanza.some((line) => line.length > RECOMMENDED_LINE_LENGTH));

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title,
        author: values.author ? values.author : null,
        groupId: values.groupId ? values.groupId : null,
        ageFrom: values.ageFrom,
        ageTo: values.ageTo,
        text: values.text,
        status: values.status,
      };
      return isEdit
        ? api.patch<Poem>(`/app/useful/poems/${poem!.id}`, payload)
        : api.post<Poem>("/app/useful/poems", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-poems", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const handleClose = () => {
    setServerError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? tr("She'rni tahrirlash") : tr("Yangi she'r")} widthClassName="max-w-3xl">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {tr(serverError)}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label={tr("Sarlavha")} placeholder={tr("Quyoshcha")} error={errors.title?.message} {...register("title")} />
          <Input label={tr("Muallif (ixtiyoriy)")} placeholder={tr("Noma'lum bo'lsa bo'sh qoldiring")} error={errors.author?.message} {...register("author")} />

          <Select label={tr("Guruh")} error={errors.groupId?.message} {...register("groupId")}>
            {!isTeacher && <option value="">{tr("Butun filial")}</option>}
            {isTeacher && <option value="">{tr("Guruhni tanlang")}</option>}
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {tr(group.name)}
              </option>
            ))}
          </Select>

          <Select label={tr("Ota-onalarga ko'rsatish")} error={errors.status?.message} {...register("status")}>
            <option value="PUBLISHED">{tr("Chop etilgan")}</option>
            <option value="DRAFT">{tr("Qoralama")}</option>
          </Select>

          <Input label={tr("Yosh (dan)")} type="number" min={2} max={7} error={errors.ageFrom?.message} {...register("ageFrom")} />
          <Input label={tr("Yosh (gacha)")} type="number" min={2} max={7} error={errors.ageTo?.message} {...register("ageTo")} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea
            label={tr("Matn")}
            hint={tr("Bandlar orasida bitta bo'sh qator qoldiring")}
            rows={10}
            error={errors.text?.message}
            {...register("text")}
          />
          <div>
            <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">{tr("Ko'rinishi")}</span>
            <div className="h-full min-h-[220px] space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface-sunken)]/40 px-4 py-3.5">
              {preview.length === 0 ? (
                <p className="text-[13px] text-[var(--color-text-muted)]">{tr("Matn kiritilgach shu yerda ko'rinadi")}</p>
              ) : (
                preview.map((stanza, i) => (
                  <p key={i} className="text-[14px] leading-relaxed text-[var(--color-text)]">
                    {stanza.map((line, j) => (
                      <span key={j}>
                        {tr(line)}
                        {j < stanza.length - 1 && <br />}
                      </span>
                    ))}
                  </p>
                ))
              )}
            </div>
            {hasLongLine && (
              <p className="mt-1.5 text-[13px] text-[var(--color-warning)]">
                {tr("Ba'zi qatorlar tavsiya etilgan")}{" "}{tr(RECOMMENDED_LINE_LENGTH)} {tr("belgidan uzun — rasmda shrift kichrayishi mumkin.")}
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            {tr("Bekor qilish")}
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? "Saqlash" : "Yaratish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
