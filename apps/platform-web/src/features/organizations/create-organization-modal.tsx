"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { organizationAccessUrl } from "@/lib/admin-web";
import type { Organization, Plan } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  firstBranchName: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.union([z.string().email("Email formati noto'g'ri"), z.literal("")]).optional(),
  contactPhone: z.string().optional(),
  planId: z.string().optional(),
  adminFullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
  adminEmail: z.string().email("Email formati noto'g'ri"),
  adminPassword: z.string().min(8, "Kamida 8 belgi"),
});

type FormValues = z.infer<typeof schema>;

export function CreateOrganizationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [created, setCreated] = useState<Organization | null>(null);

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/platform/plans"),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Organization>("/platform/organizations", {
        ...values,
        contactEmail: values.contactEmail || undefined,
        planId: values.planId || undefined,
      }),
    onSuccess: (organization) => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
      setCreated(organization);
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
  });

  const handleClose = () => {
    reset();
    setCreated(null);
    setServerError(null);
    onClose();
  };

  if (created) {
    const url = organizationAccessUrl(created.slug);
    return (
      <Modal open={open} onClose={handleClose} title="Tashkilot yaratildi">
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text)]">
            <span className="font-medium">{created.name}</span> muvaffaqiyatli yaratildi. Katta admin quyidagi havola
            orqali tizimga kirib, filiallar (bog'chalar) qo&apos;shishni boshlashi mumkin:
          </p>
          <div className="rounded-lg border border-[var(--color-border)] bg-gray-50 px-3 py-2">
            <a href={url} target="_blank" rel="noreferrer" className="break-all text-sm font-medium text-[var(--color-primary)] hover:underline">
              {url}
            </a>
          </div>
          <Button type="button" variant="secondary" size="sm" onClick={() => navigator.clipboard?.writeText(url)}>
            Havolani nusxalash
          </Button>
          <div className="flex justify-end pt-2">
            <Button type="button" onClick={handleClose}>
              Yopish
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={handleClose} title="Yangi bog'chalar tarmog'i">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div className="rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-sm text-[var(--color-danger)]">
            {serverError}
          </div>
        )}
        <Input label="Tashkilot nomi" placeholder="Quyoshcha bog'chalar tarmog'i" error={errors.name?.message} {...register("name")} />
        <Input
          label="Birinchi filial nomi"
          placeholder="Bosh filial"
          hint="Bo'sh qoldirilsa 'Bosh filial' deb yaratiladi"
          {...register("firstBranchName")}
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Aloqa shaxsi" placeholder="Aziza Karimova" {...register("contactName")} />
          <Input label="Telefon" placeholder="+998901234567" {...register("contactPhone")} />
        </div>
        <Input
          label="Email"
          type="email"
          placeholder="info@tarmoq.uz"
          error={errors.contactEmail?.message}
          {...register("contactEmail")}
        />
        <Select label="Boshlang'ich tarif reja (ixtiyoriy)" defaultValue="" {...register("planId")}>
          <option value="">Tanlanmagan — keyinroq biriktiriladi</option>
          {plans?.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {Number(plan.priceMonthly).toLocaleString("uz-UZ")} {plan.currency}/oy
            </option>
          ))}
        </Select>

        <div className="border-t border-[var(--color-border)] pt-4">
          <p className="mb-3 text-sm font-medium text-[var(--color-text)]">Katta admin akkaunti</p>
          <div className="space-y-4">
            <Input
              label="To'liq ism"
              placeholder="Aziza Karimova"
              error={errors.adminFullName?.message}
              {...register("adminFullName")}
            />
            <Input
              label="Login email"
              type="email"
              placeholder="admin@tarmoq.uz"
              error={errors.adminEmail?.message}
              {...register("adminEmail")}
            />
            <Input
              label="Parol"
              type="password"
              placeholder="Kamida 8 belgi"
              error={errors.adminPassword?.message}
              {...register("adminPassword")}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={handleClose}>
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
