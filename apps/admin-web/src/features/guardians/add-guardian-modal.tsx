"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Guardian } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import clsx from "clsx";

const schema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  relation: z.enum(["FATHER", "MOTHER", "GRANDPARENT", "OTHER"]),
  isPrimary: z.boolean(),
  canPickup: z.boolean(),
  canViewFinance: z.boolean(),
  canReceiveNotifications: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

export function AddGuardianModal({
  open,
  onClose,
  slug,
  childId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      phone: "",
      relation: "OTHER",
      isPrimary: false,
      canPickup: true,
      canViewFinance: false,
      canReceiveNotifications: true,
    },
  });

  const searchQuery = useQuery({
    queryKey: ["guardian-search", search],
    queryFn: () => api.get<Guardian[]>(`/app/guardians?search=${encodeURIComponent(search)}`),
    enabled: search.length > 0,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(`/app/children/${childId}/guardians`, {
        guardianId: mode === "existing" ? selectedGuardian?.id : undefined,
        fullName: mode === "new" ? values.fullName : undefined,
        phone: mode === "new" ? values.phone : undefined,
        relation: values.relation,
        isPrimary: values.isPrimary,
        canPickup: values.canPickup,
        canViewFinance: values.canViewFinance,
        canReceiveNotifications: values.canReceiveNotifications,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
      reset();
      setSelectedGuardian(null);
      setSearch("");
      setSearchInput("");
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    if (mode === "existing" && !selectedGuardian) {
      setServerError("Ota-onani ro'yxatdan tanlang");
      return;
    }
    if (mode === "new" && (!values.fullName || values.fullName.trim().length < 2)) {
      setServerError("To'liq ism kamida 2 belgi bo'lishi kerak");
      return;
    }
    if (mode === "new" && (!values.phone || values.phone.trim().length < 3)) {
      setServerError("Telefon raqami talab qilinadi");
      return;
    }
    mutation.mutate(values);
  };

  return (
    <Modal open={open} onClose={onClose} title="Ota-ona qo'shish" widthClassName="max-w-xl">
      <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}

        <div className="flex gap-2 rounded-lg border border-[var(--color-border)] p-1">
          <button
            type="button"
            onClick={() => setMode("existing")}
            className={clsx(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              mode === "existing" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-sunken)]",
            )}
          >
            Mavjud ota-onani biriktirish
          </button>
          <button
            type="button"
            onClick={() => setMode("new")}
            className={clsx(
              "flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors cursor-pointer",
              mode === "new" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-sunken)]",
            )}
          >
            Yangi ota-ona qo'shish
          </button>
        </div>

        {mode === "existing" ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                placeholder="Ism yoki telefon bo'yicha qidirish"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <Button type="button" variant="outline" onClick={() => setSearch(searchInput)}>
                Qidirish
              </Button>
            </div>
            {searchQuery.isFetching && <p className="text-sm text-[var(--color-text-muted)]">Qidirilmoqda...</p>}
            {searchQuery.data && searchQuery.data.length === 0 && (
              <p className="text-sm text-[var(--color-text-muted)]">Hech kim topilmadi</p>
            )}
            {searchQuery.data && searchQuery.data.length > 0 && (
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-[var(--color-border)] p-1">
                {searchQuery.data.map((g) => (
                  <button
                    type="button"
                    key={g.id}
                    onClick={() => setSelectedGuardian(g)}
                    className={clsx(
                      "block w-full rounded-md px-3 py-2 text-left text-sm cursor-pointer",
                      selectedGuardian?.id === g.id ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]" : "hover:bg-[var(--color-surface-sunken)]",
                    )}
                  >
                    <span className="font-medium">{g.fullName}</span>{" "}
                    <span className="text-[var(--color-text-muted)]">{g.phone}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedGuardian && (
              <p className="text-sm text-[var(--color-text)]">
                Tanlandi: <strong>{selectedGuardian.fullName}</strong> ({selectedGuardian.phone})
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <Input label="To'liq ism" placeholder="Karimova Aziza" {...register("fullName")} />
            <Input label="Telefon" placeholder="+998901234567" {...register("phone")} />
          </div>
        )}

        <Select label="Qarindoshlik turi" {...register("relation")}>
          <option value="FATHER">Ota</option>
          <option value="MOTHER">Ona</option>
          <option value="GRANDPARENT">Bobo/Buvi</option>
          <option value="OTHER">Boshqa</option>
        </Select>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="h-4 w-4 rounded border-[var(--color-border)]" {...register("isPrimary")} />
            Asosiy vasiy
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="h-4 w-4 rounded border-[var(--color-border)]" {...register("canPickup")} />
            Bolani olib ketishi mumkin
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input type="checkbox" className="h-4 w-4 rounded border-[var(--color-border)]" {...register("canViewFinance")} />
            Moliyani ko'ra oladi
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-text)]">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-[var(--color-border)]"
              {...register("canReceiveNotifications")}
            />
            Bildirishnoma oladi
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Qo'shish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
