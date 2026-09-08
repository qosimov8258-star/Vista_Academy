"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import type { Employee, Group } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const schema = z
  .object({
    fullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
    position: z.string().min(2, "Lavozim kamida 2 belgi"),
    // Kabinet ixtiyoriy: oshpaz yoki farrosh tizimga kirmaydi
    withAccount: z.boolean(),
    email: z.string().optional(),
    password: z.string().optional(),
    groupIds: z.array(z.string()),
  })
  .superRefine((values, ctx) => {
    if (!values.withAccount) return;
    if (!values.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(values.email)) {
      ctx.addIssue({ code: "custom", path: ["email"], message: "Email formati noto'g'ri" });
    }
    if (!values.password || values.password.length < 8) {
      ctx.addIssue({ code: "custom", path: ["password"], message: "Parol kamida 8 belgi" });
    }
    if (values.groupIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["groupIds"], message: "Kamida bitta guruh tanlang" });
    }
  });

type FormValues = z.infer<typeof schema>;

export function CreateEmployeeModal({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { withAccount: false, groupIds: [] },
  });

  const withAccount = watch("withAccount");
  const groupIds = watch("groupIds");

  const { data: groups } = useQuery({
    queryKey: ["groups", slug],
    queryFn: () => api.get<Group[]>("/app/groups"),
    enabled: open && withAccount,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Employee>("/app/employees", {
        fullName: values.fullName,
        position: values.position,
        account: values.withAccount
          ? { email: values.email, password: values.password, groupIds: values.groupIds }
          : undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      queryClient.invalidateQueries({ queryKey: ["groups", slug] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const toggleGroup = (id: string) => {
    setValue("groupIds", groupIds.includes(id) ? groupIds.filter((g) => g !== id) : [...groupIds, id], {
      shouldValidate: true,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title="Yangi xodim">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label="To'liq ism" placeholder="Yusupova Dilnoza" error={errors.fullName?.message} {...register("fullName")} />
        <Input label="Lavozim" placeholder="Tarbiyachi" error={errors.position?.message} {...register("position")} />

        <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] p-3.5">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 cursor-pointer accent-[var(--color-primary)]"
              {...register("withAccount")}
            />
            <span>
              <span className="block text-sm font-medium text-[var(--color-text)]">Kabinet ochish</span>
              <span className="block text-xs text-[var(--color-text-muted)]">
                Tarbiyachi tizimga kirib, o&apos;ziga biriktirilgan guruhlarga davomat qo&apos;yadi va kundalik
                hisobot to&apos;ldiradi. Oshpaz yoki farrosh kabi xodimlarga kerak emas.
              </span>
            </span>
          </label>

          {withAccount && (
            <div className="mt-4 space-y-4 border-t border-[var(--color-border)] pt-4">
              <Input
                label="Login email"
                type="email"
                placeholder="tarbiyachi@tarmoq.uz"
                error={errors.email?.message}
                {...register("email")}
              />
              <Input
                label="Parol"
                type="password"
                placeholder="Kamida 8 belgi"
                error={errors.password?.message}
                {...register("password")}
              />

              <div>
                <span className="mb-1.5 block text-sm font-medium text-[var(--color-text)]">Guruhlari</span>
                {!groups ? (
                  <p className="text-xs text-[var(--color-text-muted)]">Guruhlar yuklanmoqda...</p>
                ) : groups.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Avval guruh oching — tarbiyachi qaysi guruhga biriktirilishi kerakligi shundan aniqlanadi.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {groups.map((group) => {
                      const selected = groupIds.includes(group.id);
                      return (
                        <button
                          key={group.id}
                          type="button"
                          onClick={() => toggleGroup(group.id)}
                          aria-pressed={selected}
                          className={`cursor-pointer rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                            selected
                              ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                          }`}
                        >
                          {group.name}
                        </button>
                      );
                    })}
                  </div>
                )}
                {errors.groupIds?.message && (
                  <span className="mt-1.5 block text-xs text-[var(--color-danger)]">{errors.groupIds.message}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button type="submit" loading={isSubmitting || mutation.isPending}>
            Yaratish
          </Button>
        </div>
      </form>
    </Modal>
  );
}
