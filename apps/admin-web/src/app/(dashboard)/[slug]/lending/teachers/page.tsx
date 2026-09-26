"use client";

import { use, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, assetUrl } from "@/lib/api";
import type { LandingTeacher } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { CameraIcon, PencilIcon, TeacherIcon } from "@/components/ui/icons";
import { LendingTabs } from "@/features/lending/lending-tabs";
import { TeacherHighlightsSection } from "@/features/lending/teacher-highlights";

const schema = z.object({
  fullName: z.string().min(2, "Ism-familiya kamida 2 belgi"),
  role: z.string().min(2, "Lavozimi kamida 2 belgi"),
  bio: z.string().optional(),
  experience: z.string().optional(),
  order: z.coerce.number().int(),
});
type FormValues = z.infer<typeof schema>;

export default function LendingTeachersPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchSlug } = useBranchContext(slug);
  const base = branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`;
  const [editing, setEditing] = useState<LandingTeacher | null>(null);

  const teachersQuery = useQuery({
    queryKey: ["landing-teachers"],
    queryFn: () => api.get<LandingTeacher[]>("/app/landing/teachers"),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Lending sahifa</h1>
        <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
          "O'qituvchilar" bo'limida saytda chiqadigan rasm va ism — shu yerdan tahrirlanadi
        </p>
      </div>

      <LendingTabs base={base} />

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {teachersQuery.isLoading ? (
        <LoadingState rows={3} />
      ) : teachersQuery.isError ? (
        <ErrorState message={teachersQuery.error instanceof ApiError ? teachersQuery.error.message : "Xatolik yuz berdi"} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(teachersQuery.data ?? []).map((teacher) => (
            <Card key={teacher.id} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
                {teacher.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                  <img src={assetUrl(teacher.photoPath) ?? undefined} alt={teacher.fullName} className="h-full w-full object-cover" />
                ) : (
                  <TeacherIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold text-[var(--color-text)]">{teacher.fullName}</p>
                <p className="truncate text-[12px] text-[var(--color-text-muted)]">{teacher.role}</p>
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => setEditing(teacher)}
                  aria-label="Tahrirlash"
                  className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
              )}
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <TeacherFormModal teacher={editing} onClose={() => setEditing(null)} onPhotoUploaded={setEditing} />
      )}

      <TeacherHighlightsSection canWrite={canWrite} />
    </div>
  );
}

function TeacherFormModal({
  teacher,
  onClose,
  onPhotoUploaded,
}: {
  teacher: LandingTeacher;
  onClose: () => void;
  onPhotoUploaded: (teacher: LandingTeacher) => void;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: teacher.fullName,
      role: teacher.role,
      bio: teacher.bio ?? "",
      experience: teacher.experience ?? "",
      order: teacher.order,
    },
  });

  useEffect(() => {
    reset({
      fullName: teacher.fullName,
      role: teacher.role,
      bio: teacher.bio ?? "",
      experience: teacher.experience ?? "",
      order: teacher.order,
    });
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat tahrirlanayotgan o'qituvchi almashganda qayta to'ldiriladi
  }, [teacher]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.patch<LandingTeacher>(`/app/landing/teachers/${teacher.id}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-teachers"] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) => api.upload<LandingTeacher>(`/app/landing/teachers/${teacher.id}/photo`, file),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["landing-teachers"] });
      // Modal `teacher` propi ochilgan paytdagi holatni saqlab qoladi — yangi
      // rasmni shu yerda ham yangilamasak, saqlangunga qadar eski (rasmsiz)
      // holat ko'rinaveradi.
      onPhotoUploaded(updated);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Rasm yuklashda xatolik"),
  });

  return (
    <Modal open onClose={onClose} title="O'qituvchini tahrirlash">
      <div className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
            {teacher.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
              <img src={assetUrl(teacher.photoPath) ?? undefined} alt={teacher.fullName} className="h-full w-full object-cover" />
            ) : (
              <TeacherIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
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
          <Input label="Ism-familiya" placeholder="Dilnoza Qosimova" error={errors.fullName?.message} {...register("fullName")} />
          <Input label="Lavozimi" placeholder="Bosh tarbiyachi" error={errors.role?.message} {...register("role")} />
          <Textarea label="Qisqacha iqtibos" rows={2} placeholder="Kartochkada ko'rinadigan qisqa gap" error={errors.bio?.message} {...register("bio")} />
          <Textarea
            label="Tajriba va batafsil ma'lumot"
            rows={4}
            placeholder="Bosilganda chiqadigan oynada ko'rinadi: tajribasi, sertifikatlari va h.k."
            error={errors.experience?.message}
            {...register("experience")}
          />
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
