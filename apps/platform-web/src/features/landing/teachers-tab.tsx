"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, assetUrl } from "@/lib/api";
import type { LandingTeacher } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button, IconButton } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ErrorState, EmptyState, CardsSkeleton } from "@/components/ui/states";
import { CameraIcon, CloseIcon, PencilIcon, PlusIcon, TeamIcon } from "@/components/ui/icons";

const schema = z.object({
  fullName: z.string().min(2, "Ism-familiya kamida 2 belgi"),
  role: z.string().min(2, "Lavozimi kamida 2 belgi"),
  bio: z.string().optional(),
  order: z.coerce.number().int(),
});
type FormValues = z.infer<typeof schema>;

export function TeachersTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LandingTeacher | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["landing", "teachers"],
    queryFn: () => api.get<LandingTeacher[]>("/platform/landing/teachers"),
  });

  const deleteTeacher = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/landing/teachers/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing", "teachers"] }),
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
          "O'qituvchilar" bo'limida chiqadigan xodimlar ro'yxati.
        </p>
        <Button size="sm" onClick={openCreate}>
          <PlusIcon className="h-4 w-4" />
          O'qituvchi qo'shish
        </Button>
      </div>

      {isLoading ? (
        <CardsSkeleton count={3} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} />
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={TeamIcon}
          title="O'qituvchilar yo'q"
          description="Hozircha o'qituvchi qo'shilmagan"
          action={
            <Button size="sm" onClick={openCreate}>
              <PlusIcon className="h-4 w-4" />
              O'qituvchi qo'shish
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((teacher) => (
            <Card key={teacher.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                {teacher.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                  <img src={assetUrl(teacher.photoPath) ?? undefined} alt={teacher.fullName} className="h-full w-full object-cover" />
                ) : (
                  <TeamIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">{teacher.fullName}</p>
                <p className="truncate text-[12px] text-[var(--color-text-muted)]">{teacher.role}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <IconButton
                  label="Tahrirlash"
                  onClick={() => {
                    setEditing(teacher);
                    setModalOpen(true);
                  }}
                >
                  <PencilIcon className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label="O'chirish"
                  onClick={() => {
                    if (confirm(`"${teacher.fullName}"ni o'chirasizmi?`)) deleteTeacher.mutate(teacher.id);
                  }}
                  className="hover:text-[var(--color-danger)]"
                >
                  <CloseIcon className="h-4 w-4" />
                </IconButton>
              </div>
            </Card>
          ))}
        </div>
      )}

      <TeacherFormModal open={modalOpen} onClose={() => setModalOpen(false)} teacher={editing} />
    </div>
  );
}

function TeacherFormModal({
  open,
  onClose,
  teacher,
}: {
  open: boolean;
  onClose: () => void;
  teacher?: LandingTeacher | null;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(teacher);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (open) {
      reset(
        teacher
          ? { fullName: teacher.fullName, role: teacher.role, bio: teacher.bio ?? "", order: teacher.order }
          : { fullName: "", role: "", bio: "", order: 0 },
      );
      setServerError(null);
    }
  }, [open, teacher, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      isEdit
        ? api.patch<LandingTeacher>(`/platform/landing/teachers/${teacher!.id}`, values)
        : api.post<LandingTeacher>("/platform/landing/teachers", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing", "teachers"] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => api.upload<LandingTeacher>(`/platform/landing/teachers/${teacher!.id}/photo`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing", "teachers"] }),
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Rasm yuklashda xatolik"),
  });

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "O'qituvchini tahrirlash" : "Yangi o'qituvchi"}>
      <div className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        {isEdit && (
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
              {teacher!.photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                <img src={assetUrl(teacher!.photoPath) ?? undefined} alt={teacher!.fullName} className="h-full w-full object-cover" />
              ) : (
                <TeamIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
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
        )}

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <Input label="Ism-familiya" placeholder="Dilnoza Qosimova" error={errors.fullName?.message} {...register("fullName")} />
          <Input label="Lavozimi" placeholder="Bosh tarbiyachi" error={errors.role?.message} {...register("role")} />
          <Textarea label="Qisqacha ma'lumot" rows={3} placeholder="Tajribasi, sertifikatlari va h.k." error={errors.bio?.message} {...register("bio")} />
          <Input label="Tartib raqami" type="number" hint="Kichik raqam avval chiqadi" error={errors.order?.message} {...register("order")} />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Bekor qilish
            </Button>
            <Button type="submit" loading={isSubmitting || mutation.isPending}>
              Saqlash
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
