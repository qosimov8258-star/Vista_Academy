"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Organization, Plan, SubscriptionStatus } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscriptionStatusLabel } from "@/features/subscriptions/status";
import { useState } from "react";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  contactName: z.string().optional(),
  contactEmail: z.union([z.string().email("Email formati noto'g'ri"), z.literal("")]).optional(),
  contactPhone: z.string().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]),
  planId: z.string().optional(),
  subscriptionStatus: z.enum(["ACTIVE", "GRACE_PERIOD", "SUSPENDED", "CANCELLED"]),
});

type FormValues = z.infer<typeof schema>;

const emptyToNull = (value?: string) => (value?.trim() ? value.trim() : null);

const planLabel = (plan: Plan) =>
  `${plan.name} — ${Number(plan.priceMonthly).toLocaleString("uz-UZ")} ${plan.currency}/oy`;

export function EditOrganizationModal({
  open,
  onClose,
  organization,
}: {
  open: boolean;
  onClose: () => void;
  organization: Organization;
}) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const subscription = organization.subscription;

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/platform/plans"),
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    values: {
      name: organization.name,
      contactName: organization.contactName ?? "",
      contactEmail: organization.contactEmail ?? "",
      contactPhone: organization.contactPhone ?? "",
      status: organization.status,
      planId: subscription?.planId ?? "",
      subscriptionStatus: subscription?.status ?? "ACTIVE",
    },
  });

  const selectedPlanId = watch("planId");

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      await api.patch<Organization>(`/platform/organizations/${organization.id}`, {
        name: values.name.trim(),
        contactName: emptyToNull(values.contactName),
        contactEmail: emptyToNull(values.contactEmail),
        contactPhone: emptyToNull(values.contactPhone),
        status: values.status,
      });

      if (!values.planId) return;

      if (!subscription) {
        await api.post("/platform/subscriptions", {
          organizationId: organization.id,
          planId: values.planId,
        });
      } else if (subscription.planId !== values.planId) {
        await api.patch(`/platform/subscriptions/organization/${organization.id}/plan`, {
          planId: values.planId,
        });
      }

      // Yangi obuna har doim ACTIVE holatda ochiladi
      const currentStatus: SubscriptionStatus = subscription?.status ?? "ACTIVE";
      if (values.subscriptionStatus !== currentStatus) {
        if (values.subscriptionStatus === "SUSPENDED") {
          await api.patch(`/platform/subscriptions/organization/${organization.id}/suspend`);
        } else if (values.subscriptionStatus === "ACTIVE") {
          await api.patch(`/platform/subscriptions/organization/${organization.id}/activate`);
        }
      }
    },
    onSuccess: () => onClose(),
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik yuz berdi");
    },
    // Qisman bajarilgan o'zgarishlar ham darhol ko'rinishi uchun
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard", "summary"] });
    },
  });

  return (
    <Modal open={open} onClose={onClose} title="Tashkilotni tahrirlash">
      <form
        className="space-y-4"
        onSubmit={handleSubmit((values) => {
          setServerError(null);
          mutation.mutate(values);
        })}
      >
        {serverError && (
          <div
            role="alert"
            className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]"
          >
            {serverError}
          </div>
        )}
        <Input
          label="Tashkilot nomi"
          placeholder="Quyoshcha bog'chalar tarmog'i"
          hint={`Manzil (slug) o'zgarmaydi: /${organization.slug}`}
          error={errors.name?.message}
          {...register("name")}
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
        <Select
          label="Tashkilot holati"
          hint="To'xtatilgan tashkilot platformadan foydalana olmaydi"
          {...register("status")}
        >
          <option value="ACTIVE">Faol</option>
          <option value="SUSPENDED">To&apos;xtatilgan</option>
        </Select>

        <div className="space-y-4 border-t border-[var(--color-border)] pt-4">
          <Select
            label="Tarif reja"
            hint={
              subscription
                ? "Reja almashtirilsa joriy obuna yangi rejaga o'tadi"
                : "Reja tanlansa shu tashkilotga yangi obuna ochiladi"
            }
            {...register("planId")}
          >
            {!subscription && <option value="">Obunasiz — keyinroq biriktiriladi</option>}
            {plans?.map((plan) => (
              <option key={plan.id} value={plan.id}>
                {planLabel(plan)}
              </option>
            ))}
            {subscription?.plan && !plans?.some((p) => p.id === subscription.planId) && (
              <option value={subscription.planId}>{planLabel(subscription.plan)}</option>
            )}
          </Select>

          {selectedPlanId && (
            <Select
              label="Obuna holati"
              hint={subscription ? undefined : "Yangi obuna Faol holatda ochiladi"}
              {...register("subscriptionStatus")}
            >
              <option value="ACTIVE">Faol</option>
              <option value="SUSPENDED">To&apos;xtatilgan</option>
              {(subscription?.status === "GRACE_PERIOD" || subscription?.status === "CANCELLED") && (
                <option value={subscription.status}>{subscriptionStatusLabel(subscription.status)}</option>
              )}
            </Select>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
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
