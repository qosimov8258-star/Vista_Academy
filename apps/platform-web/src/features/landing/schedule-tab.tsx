"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { LandingScheduleItem, LandingScheduleType } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ErrorState, EmptyState, TableSkeleton } from "@/components/ui/states";
import { ClockIcon, CloseIcon, PencilIcon, PlusIcon } from "@/components/ui/icons";

const TYPE_LABELS: Record<LandingScheduleType, string> = {
  LESSON: "Dars",
  SLEEP: "Uyqu",
  MEAL: "Ovqat",
  OTHER: "Boshqa",
};

const TYPE_TONES: Record<LandingScheduleType, "primary" | "warning" | "success" | "neutral"> = {
  LESSON: "primary",
  SLEEP: "warning",
  MEAL: "success",
  OTHER: "neutral",
};

const schema = z.object({
  time: z.string().min(1, "Vaqt kiriting"),
  title: z.string().min(2, "Nomi kamida 2 belgi"),
  type: z.enum(["LESSON", "SLEEP", "MEAL", "OTHER"]),
  order: z.coerce.number().int(),
});
type FormValues = z.infer<typeof schema>;

export function ScheduleTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LandingScheduleItem | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landing", "schedule"],
    queryFn: () => api.get<LandingScheduleItem[]>("/platform/landing/schedule"),
  });

  const deleteItem = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/landing/schedule/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing", "schedule"] }),
    onError: (err) => alert(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const openCreate = () => {
    setEditing(null);
    setModalOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--color-text-muted)]">
          "Moslashuvchan jadval" bo'limida chiqadigan kun tartibi — vaqt bo'yicha tartiblangan qatorlar.
        </p>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="h-4 w-4" />
          Qator qo'shish
        </Button>
      </div>

      {isLoading ? (
        <Card className="overflow-hidden">
          <TableSkeleton rows={5} columns={3} />
        </Card>
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={ClockIcon}
          title="Jadval bo'sh"
          description="Hozircha kun tartibi qatorlari qo'shilmagan"
          action={
            <Button size="sm" onClick={openCreate}>
              <PlusIcon className="h-4 w-4" />
              Qator qo'shish
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[var(--color-separator)]">
            {data.map((item) => (
              <li key={item.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-14 shrink-0 font-mono text-[13px] tabular-nums text-[var(--color-text-muted)]">
                  {item.time}
                </span>
                <span className="flex-1 truncate text-[14px] text-[var(--color-text)]">{item.title}</span>
                <Badge tone={TYPE_TONES[item.type]}>{TYPE_LABELS[item.type]}</Badge>
                <IconButton
                  label="Tahrirlash"
                  onClick={() => {
                    setEditing(item);
                    setModalOpen(true);
                  }}
                >
                  <PencilIcon className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="O'chirish"
                  onClick={() => {
                    if (confirm(`"${item.title}" qatorini o'chirasizmi?`)) deleteItem.mutate(item.id);
                  }}
                  className="hover:text-[var(--color-danger)]"
                >
                  <CloseIcon className="h-4 w-4" />
                </IconButton>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <ScheduleItemFormModal open={modalOpen} onClose={() => setModalOpen(false)} item={editing} />
    </div>
  );
}

function ScheduleItemFormModal({
  open,
  onClose,
  item,
}: {
  open: boolean;
  onClose: () => void;
  item?: LandingScheduleItem | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const isEdit = Boolean(item);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset(
        item
          ? { time: item.time, title: item.title, type: item.type, order: item.order }
          : { time: "08:00", title: "", type: "OTHER", order: 0 },
      );
      setServerError(null);
    }
  }, [open, item, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? api.patch<LandingScheduleItem>(`/platform/landing/schedule/${item!.id}`, values)
        : api.post<LandingScheduleItem>("/platform/landing/schedule", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing", "schedule"] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Qatorni tahrirlash" : "Yangi qator"}>
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input label="Vaqt" placeholder="08:00" error={errors.time?.message} {...register("time")} />
          <Select label="Turi" error={errors.type?.message} {...register("type")}>
            <option value="LESSON">Dars</option>
            <option value="SLEEP">Uyqu</option>
            <option value="MEAL">Ovqat</option>
            <option value="OTHER">Boshqa</option>
          </Select>
        </div>
        <Input label="Nomi" placeholder="Ingliz tili darsi" error={errors.title?.message} {...register("title")} />
        <Input label="Tartib raqami" type="number" hint="Kichik raqam yuqorida chiqadi" error={errors.order?.message} {...register("order")} />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Saqlash
          </Button>
        </div>
      </form>
    </Modal>
  );
}
