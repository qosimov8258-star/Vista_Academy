"use client";

import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Proverb } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function buildSchema(groupRequired: boolean) {
  return z.object({
    text: z.string().min(3, "Kamida 3 belgi").max(160, "Ko'pi bilan 160 belgi"),
    meaning: z.string().min(3, "Kamida 3 belgi").max(400, "Ko'pi bilan 400 belgi"),
    groupId: groupRequired ? z.string().min(1, "Guruhni tanlang") : z.string().optional(),
    status: z.enum(["PUBLISHED", "DRAFT"]),
  });
}

type FormValues = z.infer<ReturnType<typeof buildSchema>>;

export function ProverbModal({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  proverb,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  isTeacher: boolean;
  proverb?: Proverb | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = !!proverb;
  const schema = useMemo(() => buildSchema(isTeacher), [isTeacher]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      text: proverb?.text ?? "",
      meaning: proverb?.meaning ?? "",
      groupId: proverb?.groupId ?? "",
      status: proverb?.status ?? "PUBLISHED",
    },
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) => {
      const payload = {
        text: values.text,
        meaning: values.meaning,
        groupId: values.groupId ? values.groupId : null,
        status: values.status,
      };
      return isEdit
        ? api.patch<Proverb>(`/app/useful/proverbs/${proverb!.id}`, payload)
        : api.post<Proverb>("/app/useful/proverbs", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-proverbs", slug] });
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
    <Modal open={open} onClose={handleClose} title={isEdit ? "Maqolni tahrirlash" : "Yangi maqol"}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <Textarea label="Maqol" rows={2} error={errors.text?.message} {...register("text")} />
        <Textarea
          label="Ma'nosi (bolaga qanday tushuntirasiz)"
          rows={3}
          error={errors.meaning?.message}
          {...register("meaning")}
        />

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
