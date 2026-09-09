"use client";

import { useEffect, useState } from "react";
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
import { CheckCircleIcon } from "@/components/ui/icons";
import { formatMoney } from "@/lib/format";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  contactName: z.string().optional(),
  contactEmail: z.union([z.string().email("Email formati noto'g'ri"), z.literal("")]).optional(),
  contactPhone: z.string().optional(),
  planId: z.string().min(1, "Tarif tanlang"),
  adminFullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
  adminEmail: z.string().email("Email formati noto'g'ri"),
  adminPassword: z.string().min(8, "Kamida 8 belgi"),
});

type FormValues = z.infer<typeof schema>;

export function CreateOrganizationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
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

  useEffect(() => {
    if (open) {
      reset({ name: "", contactName: "", contactEmail: "", contactPhone: "", planId: "" });
      setServerError(null);
    }
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post<Organization>("/platform/organizations", {
        ...values,
        contactEmail: values.contactEmail || undefined,
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
            <span className="font-medium">{created.name}</span> muvaffaqiyatli yaratildi. Super Admin quyidagi havola
            orqali tizimga kirib, filiallar (bog'chalar) qo&apos;shishni boshlashi mumkin:
          </p>
          <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-3.5 py-2.5">
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="break-all text-[13px] font-medium text-[var(--color-primary)] hover:underline"
            >
              {url}
            </a>
          </div>
          {/* Nusxalash tugmasi bosilganini bildiradi — aks holda hech nima
              o'zgarmagandek tuyuladi va foydalanuvchi qayta bosaveradi. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={async () => {
              await navigator.clipboard?.writeText(url);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            {copied ? (
              <>
                <CheckCircleIcon className="h-4 w-4 text-[var(--color-success)]" />
                Nusxalandi
              </>
            ) : (
              "Havolani nusxalash"
            )}
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
    <Modal open={open} onClose={handleClose} title="Yangi bog'cha">
      <form className="space-y-4" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        {serverError && (
          <div
            role="alert"
            className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]"
          >
            {serverError}
          </div>
        )}
        <Input label="Bog'cha nomi" placeholder="Quyoshcha bog'chasi" error={errors.name?.message} {...register("name")} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Ism" placeholder="Aziza Karimova" {...register("contactName")} />
          <Input label="Telefon raqami" placeholder="+998901234567" {...register("contactPhone")} />
        </div>
        <Input
          label="Email"
          type="email"
          placeholder="info@bogcha.uz"
          error={errors.contactEmail?.message}
          {...register("contactEmail")}
        />
        <Select label="Tarif" defaultValue="" error={errors.planId?.message} {...register("planId")}>
          <option value="" disabled>
            Tarif tanlang...
          </option>
          {plans?.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {formatMoney(plan.priceMonthly, plan.currency)}/oy
            </option>
          ))}
        </Select>

        <div className="border-t border-[var(--color-border)] pt-4">
          <p className="mb-3 text-sm font-medium text-[var(--color-text)]">Super Admin akkaunti</p>
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
          <Button type="button" variant="outline" onClick={handleClose}>
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
