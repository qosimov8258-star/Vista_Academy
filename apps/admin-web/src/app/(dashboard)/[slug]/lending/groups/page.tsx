"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError, assetUrl } from "@/lib/api";
import type { LandingGroup } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteOperational } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { GroupIcon, PencilIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { LendingTabs } from "@/features/lending/lending-tabs";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  order: z.coerce.number().int(),
});
type FormValues = z.infer<typeof schema>;

/** Saytdagi ("Guruhlarimiz" bo'limi) bilan bir xil — rasmi bo'lmagan guruhning kartochka foni. */
const CARD_COLORS = [
  "#ef8a63",
  "#4ca6d4",
  "#61ae41",
  "#cf5599",
  "#e0a600",
  "#aead45",
  "#2f86b3",
  "#c4694e",
];

export default function LendingGroupsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteOperational(user?.role);
  const { branchSlug } = useBranchContext(slug);
  const base = branchSlug ? `/${slug}/${branchSlug}` : `/${slug}`;
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<LandingGroup | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["landing-groups"],
    queryFn: () => api.get<LandingGroup[]>("/app/landing/groups"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/landing/groups/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-groups"] });
      setDeleting(null);
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-[var(--tracking-title)] text-[var(--color-text)]">Lending sahifa</h1>
          <p className="mt-0.5 text-[14px] text-[var(--color-text-muted)]">
            "Guruhlarimiz" bo'limida saytda chiqadigan rasm va nom — shu yerdan tahrirlanadi. Guruhni bosib,
            uning o'z sahifasidagi rasmlarni ham boshqarish mumkin.
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setCreateOpen(true)}>
            <PlusIcon className="h-4 w-4" />
            Guruh qo'shish
          </Button>
        )}
      </div>

      <LendingTabs base={base} />

      {!canWrite && <ViewOnlyNote role={user?.role} />}

      {groupsQuery.isLoading ? (
        <LoadingState rows={3} />
      ) : groupsQuery.isError ? (
        <ErrorState message={groupsQuery.error instanceof ApiError ? groupsQuery.error.message : "Xatolik yuz berdi"} />
      ) : !groupsQuery.data || groupsQuery.data.length === 0 ? (
        <EmptyState
          icon={<GroupIcon className="h-[26px] w-[26px]" />}
          title="Hali guruh yo'q"
          description={canWrite ? "\"+ Guruh qo'shish\" tugmasi orqali birinchisini qo'shing" : undefined}
        />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {groupsQuery.data.map((group, index) => (
            <div
              key={group.id}
              className="group relative aspect-square overflow-hidden rounded-[var(--radius-md)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] transition-transform duration-150 hover:scale-[1.03]"
            >
              <Link href={`${base}/lending/groups/${group.id}`} className="absolute inset-0 block">
                {group.photoPath ? (
                  // eslint-disable-next-line @next/next/no-img-element -- API'dan kelgan dinamik rasm, saytdagi bilan bir xil ko'rinish
                  <img
                    src={assetUrl(group.photoPath) ?? undefined}
                    alt={group.name}
                    className="h-full w-full bg-[var(--color-surface-sunken)] object-contain"
                  />
                ) : (
                  <div
                    className="flex h-full w-full flex-col items-center justify-center p-4 text-center"
                    style={{ background: CARD_COLORS[index % CARD_COLORS.length] }}
                  >
                    <span className="text-[13px] font-bold text-white/70">{index + 1}</span>
                    <p className="mt-1 text-[16px] font-bold leading-tight text-white">{group.name}</p>
                  </div>
                )}
              </Link>

              {/* Saytdagi kartochkadan farqi — ustiga borilganda tahrirlash/o'chirish chiqadi */}
              {canWrite && (
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-2 opacity-0 transition-opacity duration-150 group-hover:bg-black/30 group-hover:opacity-100">
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setDeleting(group)}
                      aria-label="O'chirish"
                      className="pointer-events-auto flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-white transition-colors hover:bg-[var(--color-danger)]"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-center gap-1.5 rounded-full bg-black/45 px-3 py-1.5 text-[12.5px] font-medium text-white">
                    <PencilIcon className="h-3.5 w-3.5" />
                    Tahrirlash
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {canWrite && <CreateGroupModal open={createOpen} onClose={() => setCreateOpen(false)} />}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Guruhni o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.isError ? ((deleteMutation.error as Error)?.message ?? null) : null}
        description={<><b className="text-[var(--color-text)]">{deleting?.name}</b> saytdan o&apos;chiriladi.</>}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}

function CreateGroupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: { name: "", order: 0 } });

  useEffect(() => {
    if (open) {
      reset({ name: "", order: 0 });
      setServerError(null);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) => api.post<LandingGroup>("/app/landing/groups", values),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["landing-groups"] });
      onClose();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  return (
    <Modal open={open} onClose={onClose} title="Yangi guruh">
      <div className="space-y-4">
        {serverError && (
          <div role="alert" className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <Input label="Nomi" placeholder="Kichkintoylar" error={errors.name?.message} {...register("name")} />
          <Input label="Tartib raqami" type="number" hint="Kichik raqam avval chiqadi" error={errors.order?.message} {...register("order")} />
          <p className="text-[13px] text-[var(--color-text-muted)]">
            Rasm va nomni keyinroq guruh ustiga bosib, uning sahifasida tahrirlashingiz mumkin.
          </p>
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
