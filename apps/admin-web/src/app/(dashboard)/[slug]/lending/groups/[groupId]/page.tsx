"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, assetUrl } from "@/lib/api";
import type { LandingGroup, LandingGroupStudent } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { canWriteOperational } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ArrowLeftIcon, CameraIcon, CloseIcon, GroupIcon, PencilIcon, PlusIcon, TrashIcon, UserIcon } from "@/components/ui/icons";

const infoSchema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  order: z.coerce.number().int(),
});
type InfoFormValues = z.infer<typeof infoSchema>;

/** Guruh sahifasida bir vaqtda ko'rsatiladigan o'quvchi joylari soni. */
const STUDENT_SLOTS = 4;

const studentSchema = z.object({
  name: z.string().min(2, "Ismi kamida 2 belgi"),
  bio: z.string().optional(),
});
type StudentFormValues = z.infer<typeof studentSchema>;

/**
 * Guruhning o'z sahifasi (landing-web `/guruhlar/[slug]`) qanday ko'rinishini
 * takrorlaydi — bosh rasm (hero) va galereya bir xil joylashuvda, farqi
 * shundaki bu yerda har bir rasm ustiga bosib uni almashtirish/o'chirish mumkin.
 */
export default function LendingGroupDetailPage({ params }: { params: Promise<{ slug: string; groupId: string }> }) {
  const { slug, groupId } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
  const [studentModal, setStudentModal] = useState<{ mode: "create"; order: number } | { mode: "edit"; student: LandingGroupStudent } | null>(
    null,
  );
  const [deletingStudent, setDeletingStudent] = useState<LandingGroupStudent | null>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const groupsQuery = useQuery({
    queryKey: ["landing-groups"],
    queryFn: () => api.get<LandingGroup[]>("/app/landing/groups"),
  });
  const group = groupsQuery.data?.find((g) => g.id === groupId) ?? null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InfoFormValues>({ resolver: zodResolver(infoSchema) });

  useEffect(() => {
    if (group) reset({ name: group.name, order: group.order });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- faqat boshqa guruhga o'tilganda qayta to'ldiriladi
  }, [group?.id]);

  const infoMutation = useMutation({
    mutationFn: (values: InfoFormValues) => api.patch<LandingGroup>(`/app/landing/groups/${groupId}`, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing-groups"] }),
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Saqlashda xatolik"),
  });

  const coverMutation = useMutation({
    mutationFn: (file: File) => api.upload<LandingGroup>(`/app/landing/groups/${groupId}/photo`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing-groups"] }),
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Rasm yuklashda xatolik"),
  });

  const addPhotoMutation = useMutation({
    mutationFn: (file: File) => api.upload(`/app/landing/groups/${groupId}/photos`, file),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["landing-groups"] }),
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Rasm yuklashda xatolik"),
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => api.delete(`/app/landing/groups/${groupId}/photos/${photoId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-groups"] });
      setDeletingPhotoId(null);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "O'chirishda xatolik"),
  });

  const deleteStudentMutation = useMutation({
    mutationFn: (studentId: string) => api.delete(`/app/landing/groups/${groupId}/students/${studentId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-groups"] });
      setDeletingStudent(null);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "O'chirishda xatolik"),
  });

  const handleCoverPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      setServerError(null);
      coverMutation.mutate(file);
    }
  };

  const handlePhotoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) {
      setServerError(null);
      addPhotoMutation.mutate(file);
    }
  };

  return (
    <div className="space-y-5">
      <Link
        href={`/${slug}/lending/groups`}
        className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text)]"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        Guruhlar
      </Link>

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {serverError && (
        <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[13px] text-[var(--color-danger)]">
          {serverError}
        </div>
      )}

      {groupsQuery.isLoading ? (
        <LoadingState rows={4} />
      ) : groupsQuery.isError ? (
        <ErrorState message={groupsQuery.error instanceof ApiError ? groupsQuery.error.message : "Xatolik yuz berdi"} />
      ) : !group ? (
        <ErrorState message="Guruh topilmadi" />
      ) : (
        <>
          {/* Hero — guruh sahifasidagi bosh rasm bilan bir xil joylashuv (object-contain — saytdagi kabi kesilmasdan to'liq ko'rinadi) */}
          <div className="relative h-[220px] w-full overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-surface-sunken)] sm:h-[300px]">
            {group.photoPath ? (
              // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
              <img src={assetUrl(group.photoPath) ?? undefined} alt={group.name} className="absolute inset-0 h-full w-full object-contain" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <GroupIcon className="h-10 w-10 text-[var(--color-text-subtle)]" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-white/80">Guruhlarimiz</p>
              <h1 className="text-[24px] font-semibold text-white sm:text-[28px]">{group.name}</h1>
            </div>
            {canWrite && (
              <>
                <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverPick} />
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverMutation.isPending}
                  title="Tavsiya: kvadrat (1:1) rasm, kamida 800x800px — bosh sahifadagi kartochkada ham, bu yerdagi katta rasmda ham kesilmasdan to'liq chiqadi"
                  className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-black/40 px-3.5 py-2 text-[13px] font-medium text-white backdrop-blur-sm transition-colors hover:bg-black/55 disabled:cursor-wait"
                >
                  <CameraIcon className="h-3.5 w-3.5" />
                  {coverMutation.isPending ? "Yuklanmoqda..." : "Bosh rasmni almashtirish"}
                </button>
              </>
            )}
          </div>
          {canWrite && (
            <p className="text-[12.5px] text-[var(--color-text-muted)]">
              Tavsiya: kvadrat (1:1) rasm, kamida 800×800px, fon oq yoki shaffof — shu rasm bosh sahifadagi
              kartochkada va guruh sahifasining katta rasmida kesilmasdan to&apos;liq ko&apos;rinadi.
            </p>
          )}

          {/* Nomi va tartib raqami */}
          <div className="rounded-[var(--radius-xl)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] p-4 sm:p-5">
            <h2 className="text-[16px] font-semibold text-[var(--color-text)]">Ma&apos;lumotlari</h2>
            {canWrite ? (
              <form
                className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end"
                onSubmit={handleSubmit((values) => infoMutation.mutate(values))}
              >
                <Input label="Nomi" placeholder="Kichkintoylar" error={errors.name?.message} {...register("name")} />
                <Input
                  label="Tartib raqami"
                  type="number"
                  hint="Kichik raqam avval chiqadi"
                  error={errors.order?.message}
                  {...register("order")}
                />
                <Button type="submit" loading={isSubmitting || infoMutation.isPending}>
                  Saqlash
                </Button>
              </form>
            ) : (
              <p className="mt-2 text-[14px] text-[var(--color-text-muted)]">{group.name}</p>
            )}
          </div>

          {/* O'quvchilar — guruh sahifasidagi "N-o'quvchi" joylarini to'ldiradi */}
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-text)]">O&apos;quvchilar</h2>
            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
              Guruh sahifasida &quot;{STUDENT_SLOTS}-o&apos;quvchi&quot; nomi bilan chiqadigan joylar — rasmi, ismi va
              qisqa bio&apos;si shu yerdan to&apos;ldiriladi. To&apos;ldirilmagan joylarda &quot;tez orada
              qo&apos;shiladi&quot; degan yozuv chiqadi.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: STUDENT_SLOTS }, (_, index) => {
                const student = group.students[index];
                if (!student) {
                  return canWrite ? (
                    <button
                      key={`empty-${index}`}
                      type="button"
                      onClick={() => setStudentModal({ mode: "create", order: index })}
                      className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)]"
                    >
                      <PlusIcon className="h-5 w-5" />
                      <span className="text-[12.5px] font-medium">{index + 1}-o&apos;quvchi qo&apos;shish</span>
                    </button>
                  ) : (
                    <div
                      key={`empty-${index}`}
                      className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-hair)] text-[var(--color-text-subtle)]"
                    >
                      <UserIcon className="h-6 w-6" />
                      <span className="text-[12.5px]">{index + 1}-o&apos;quvchi</span>
                    </div>
                  );
                }

                return (
                  <div key={student.id} className="group relative">
                    <div className="aspect-[3/4] overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)]">
                      {student.photoPath ? (
                        // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                        <img src={assetUrl(student.photoPath) ?? undefined} alt={student.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <UserIcon className="h-8 w-8 text-[var(--color-text-subtle)]" />
                        </div>
                      )}
                      {canWrite && (
                        <div className="pointer-events-none absolute inset-0 flex items-start justify-end gap-1 p-1.5 opacity-0 transition-opacity duration-150 group-hover:bg-black/25 group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={() => setStudentModal({ mode: "edit", student })}
                            aria-label="Tahrirlash"
                            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-black/65"
                          >
                            <PencilIcon className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStudent(student)}
                            aria-label="O'chirish"
                            className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-[var(--color-danger)]"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                    <p className="mt-2 truncate text-[14px] font-semibold text-[var(--color-text)]">{student.name}</p>
                    {student.bio && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-[var(--color-text-muted)]">{student.bio}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Galereya — guruh sahifasida (saytda) shu rasmlar ko'rsatiladi */}
          <div>
            <h2 className="text-[16px] font-semibold text-[var(--color-text)]">Guruh sahifasidagi rasmlar</h2>
            <p className="mt-0.5 text-[13px] text-[var(--color-text-muted)]">
              Bu yerga qo&apos;shilgan birinchi rasm &quot;{group.name}&quot; guruhining o&apos;z sahifasida (saytda)
              &quot;Farzandingiz shu yerda o&apos;sadi va rivojlanadi&quot; bo&apos;limidagi katta rasm sifatida
              ko&apos;rsatiladi. Tavsiya: kvadrat (1:1) rasm, kamida 600×600px — markazdan kesib ko&apos;rsatiladi.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {group.photos.map((photo) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm */}
                  <img src={assetUrl(photo.path) ?? undefined} alt={group.name} className="h-full w-full object-cover" />
                  {canWrite && (
                    <button
                      type="button"
                      onClick={() => setDeletingPhotoId(photo.id)}
                      aria-label="Rasmni o'chirish"
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-opacity hover:bg-[var(--color-danger)] group-hover:opacity-100"
                    >
                      <CloseIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}

              {canWrite && (
                <>
                  <input ref={galleryInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    disabled={addPhotoMutation.isPending}
                    className="flex aspect-square flex-col items-center justify-center gap-1.5 rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border)] bg-[var(--color-surface-sunken)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-hover)] disabled:cursor-wait"
                  >
                    {addPhotoMutation.isPending ? (
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    ) : (
                      <PlusIcon className="h-5 w-5" />
                    )}
                    <span className="text-[12.5px] font-medium">Rasm qo&apos;shish</span>
                  </button>
                </>
              )}
            </div>

            {group.photos.length === 0 && !canWrite && (
              <p className="mt-4 text-[13px] text-[var(--color-text-muted)]">Hali rasm qo&apos;shilmagan</p>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!deletingPhotoId}
        onClose={() => setDeletingPhotoId(null)}
        title="Rasmni o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deletePhotoMutation.isPending}
        error={deletePhotoMutation.isError ? ((deletePhotoMutation.error as Error)?.message ?? null) : null}
        description="Bu rasm guruh sahifasidan butunlay o'chiriladi."
        onConfirm={() => deletingPhotoId && deletePhotoMutation.mutate(deletingPhotoId)}
      />

      {studentModal && <StudentFormModal groupId={groupId} modal={studentModal} onClose={() => setStudentModal(null)} />}

      <ConfirmDialog
        open={!!deletingStudent}
        onClose={() => setDeletingStudent(null)}
        title="O'quvchini o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteStudentMutation.isPending}
        error={deleteStudentMutation.isError ? ((deleteStudentMutation.error as Error)?.message ?? null) : null}
        description={<><b className="text-[var(--color-text)]">{deletingStudent?.name}</b> guruh sahifasidan butunlay o&apos;chiriladi.</>}
        onConfirm={() => deletingStudent && deleteStudentMutation.mutate(deletingStudent.id)}
      />
    </div>
  );
}

function StudentFormModal({
  groupId,
  modal,
  onClose,
}: {
  groupId: string;
  modal: { mode: "create"; order: number } | { mode: "edit"; student: LandingGroupStudent };
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [photoPath, setPhotoPath] = useState<string | null>(modal.mode === "edit" ? modal.student.photoPath : null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<StudentFormValues>({
    resolver: zodResolver(studentSchema),
    defaultValues:
      modal.mode === "edit" ? { name: modal.student.name, bio: modal.student.bio ?? "" } : { name: "", bio: "" },
  });

  const createMutation = useMutation({
    mutationFn: (values: StudentFormValues) =>
      api.post<LandingGroupStudent>(`/app/landing/groups/${groupId}/students`, { ...values, order: modal.mode === "create" ? modal.order : 0 }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-groups"] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const updateMutation = useMutation({
    mutationFn: (values: StudentFormValues) =>
      api.patch<LandingGroupStudent>(`/app/landing/groups/${groupId}/students/${modal.mode === "edit" ? modal.student.id : ""}`, values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-groups"] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const photoMutation = useMutation({
    mutationFn: (file: File) =>
      api.upload<LandingGroupStudent>(`/app/landing/groups/${groupId}/students/${modal.mode === "edit" ? modal.student.id : ""}/photo`, file),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["landing-groups"] });
      setPhotoPath(updated.photoPath);
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Rasm yuklashda xatolik"),
  });

  const mutation = modal.mode === "edit" ? updateMutation : createMutation;

  return (
    <Modal open onClose={onClose} title={modal.mode === "edit" ? "O'quvchini tahrirlash" : "Yangi o'quvchi"}>
      <div className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        {modal.mode === "edit" && (
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--color-surface-sunken)]">
              {photoPath ? (
                // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm
                <img src={assetUrl(photoPath) ?? undefined} alt={modal.student.name} className="h-full w-full object-cover" />
              ) : (
                <UserIcon className="h-6 w-6 text-[var(--color-text-subtle)]" />
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) photoMutation.mutate(file);
                e.target.value = "";
              }}
            />
            <Button type="button" size="sm" variant="outline" loading={photoMutation.isPending} onClick={() => photoInputRef.current?.click()}>
              <CameraIcon className="h-4 w-4" />
              Rasm yuklash
            </Button>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <Input label="Ismi" placeholder="Amir Vositov" error={errors.name?.message} {...register("name")} />
          <Textarea
            label="Bio (qisqa matn)"
            rows={3}
            placeholder="Masalan: rasm chizishni yaxshi ko'radi"
            error={errors.bio?.message}
            {...register("bio")}
          />
          {modal.mode === "create" && (
            <p className="text-[13px] text-[var(--color-text-muted)]">Rasmni saqlagandan keyin, o&apos;quvchini qayta ochib qo&apos;shishingiz mumkin.</p>
          )}
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
