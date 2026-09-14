"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Tale } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { splitIntoBlocks } from "./split-blocks";

const COVERS = [
  { value: "tun", label: "Tungi osmon" },
  { value: "sholgom", label: "Sholg'om" },
];

function parseQuestions(raw: string | undefined): string[] {
  return (raw ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function buildSchema(groupRequired: boolean) {
  return z
    .object({
      title: z.string().min(1, "Sarlavhani kiriting").max(80),
      origin: z.string().min(1, "Kelib chiqishini kiriting").max(120),
      text: z.string().min(1, "Matnni kiriting").max(8000),
      moral: z.string().min(3, "Kamida 3 belgi").max(300),
      questionsText: z.string().optional(),
      minutesText: z.string().optional(),
      cover: z.enum(["tun", "sholgom"]),
      groupId: groupRequired ? z.string().min(1, "Guruhni tanlang") : z.string().optional(),
      ageFrom: z.coerce.number().int().min(2).max(7),
      ageTo: z.coerce.number().int().min(2).max(7),
      status: z.enum(["PUBLISHED", "DRAFT"]),
    })
    .refine((v) => v.ageFrom <= v.ageTo, { message: "Boshlanishi tugashidan katta bo'lmasin", path: ["ageTo"] })
    .superRefine((v, ctx) => {
      const questions = parseQuestions(v.questionsText);
      if (questions.length > 8) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Ko'pi bilan 8 ta savol", path: ["questionsText"] });
      }
      if (questions.some((q) => q.length < 3 || q.length > 150)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Har bir savol 3–150 belgidan iborat bo'lishi kerak",
          path: ["questionsText"],
        });
      }
    });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function TaleModal({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  tale,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  isTeacher: boolean;
  tale?: Tale | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!tale;
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
      title: tale?.title ?? "",
      origin: tale?.origin ?? "",
      text: tale ? tale.paragraphs.join("\n\n") : "",
      moral: tale?.moral ?? "",
      questionsText: tale?.questions.join("\n") ?? "",
      minutesText: tale?.minutes ? String(tale.minutes) : "",
      cover: (tale?.cover as "tun" | "sholgom") ?? "tun",
      groupId: tale?.groupId ?? "",
      ageFrom: tale?.ageFrom ?? 3,
      ageTo: tale?.ageTo ?? 7,
      status: tale?.status ?? "PUBLISHED",
    },
  });

  const text = watch("text") ?? "";
  const preview = useMemo(() => splitIntoBlocks(text).map((block) => block.join(" ")), [text]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        title: values.title,
        origin: values.origin,
        text: values.text,
        moral: values.moral,
        questions: parseQuestions(values.questionsText),
        minutes: values.minutesText ? Number(values.minutesText) : null,
        cover: values.cover,
        groupId: values.groupId ? values.groupId : null,
        ageFrom: values.ageFrom,
        ageTo: values.ageTo,
        status: values.status,
      };
      return isEdit
        ? api.patch<Tale>(`/app/useful/tales/${tale!.id}`, payload)
        : api.post<Tale>("/app/useful/tales", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-tales", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const handleClose = () => {
    setServerError(null);
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title={isEdit ? "Ertakni tahrirlash" : "Yangi ertak"} widthClassName="max-w-3xl">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Sarlavha" placeholder="Sholg'om" error={errors.title?.message} {...register("title")} />
          <Input
            label="Kelib chiqishi"
            placeholder="O'zbek xalq ertagi"
            error={errors.origin?.message}
            {...register("origin")}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Textarea
            label="Matn"
            hint="Xatboshilar orasida bitta bo'sh qator qoldiring"
            rows={10}
            error={errors.text?.message}
            {...register("text")}
          />
          <div>
            <span className="mb-2 block text-[13px] font-medium text-[var(--color-text)]">Ko'rinishi</span>
            <div className="h-full min-h-[220px] space-y-3 rounded-[var(--radius-md)] border border-[var(--color-border-hair)] bg-[var(--color-surface-sunken)]/40 px-4 py-3.5">
              {preview.length === 0 ? (
                <p className="text-[13px] text-[var(--color-text-muted)]">Matn kiritilgach shu yerda ko&apos;rinadi</p>
              ) : (
                preview.map((paragraph, i) => (
                  <p key={i} className="text-[14px] leading-relaxed text-[var(--color-text)]">
                    {paragraph}
                  </p>
                ))
              )}
            </div>
          </div>
        </div>

        <Textarea label="Saboq" rows={2} error={errors.moral?.message} {...register("moral")} />
        <Textarea
          label="Savollar (ixtiyoriy, har qatorga bitta)"
          hint="Ko'pi bilan 8 ta"
          rows={3}
          error={errors.questionsText?.message}
          {...register("questionsText")}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="O'qish daqiqasi (ixtiyoriy)"
            type="number"
            min={1}
            placeholder="Bo'sh qoldirilsa — avtomatik hisoblanadi"
            error={errors.minutesText?.message}
            {...register("minutesText")}
          />
          <Select label="Muqova" error={errors.cover?.message} {...register("cover")}>
            {COVERS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </Select>

          <Select label="Guruh" error={errors.groupId?.message} {...register("groupId")}>
            {!isTeacher && <option value="">Butun filial</option>}
            {isTeacher && <option value="">Guruhni tanlang</option>}
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </Select>
          <Select label="Ota-onalarga ko'rsatish" error={errors.status?.message} {...register("status")}>
            <option value="PUBLISHED">Chop etilgan</option>
            <option value="DRAFT">Qoralama</option>
          </Select>

          <Input label="Yosh (dan)" type="number" min={2} max={7} error={errors.ageFrom?.message} {...register("ageFrom")} />
          <Input label="Yosh (gacha)" type="number" min={2} max={7} error={errors.ageTo?.message} {...register("ageTo")} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={handleClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            {isEdit ? "Saqlash" : "Yaratish"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
