"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { revealOrganizationAdminPassword, webauthnErrorMessage } from "@/lib/webauthn";
import type { Organization, Plan, SubscriptionStatus } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { PasswordVeilInput } from "@/components/ui/password-veil-input";
import { Button } from "@/components/ui/button";
import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";
import { subscriptionStatusLabel } from "@/features/subscriptions/status";
import { useEffect, useState } from "react";

const schema = z.object({
  name: z.string().min(2, "Nomi kamida 2 belgi"),
  contactName: z.string().optional(),
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

  const [visiblePassword, setVisiblePassword] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  const [loginDraft, setLoginDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [credentialsError, setCredentialsError] = useState<string | null>(null);

  // Modal yopilganda ko'rsatilgan parol ekranda qolib ketmasligi uchun —
  // qayta ochilganda yana WebAuthn tasdiqlashi talab qilinadi.
  useEffect(() => {
    if (!open) {
      setVisiblePassword(null);
      setRevealing(false);
      setRevealError(null);
      setLoginDraft("");
      setPasswordDraft("");
      setCredentialsError(null);
    }
  }, [open]);

  const subscription = organization.subscription;

  const { data: plans } = useQuery({
    queryKey: ["plans"],
    queryFn: () => api.get<Plan[]>("/platform/plans"),
    enabled: open,
  });

  const { data: adminAccount } = useQuery({
    queryKey: ["organization-admin", organization.id],
    queryFn: () => api.get<{ login: string; hasStoredPassword: boolean }>(`/platform/organizations/${organization.id}/admin`),
    enabled: open,
  });

  // Tahrirlash maydoni joriy login bilan boshlansin — foydalanuvchi
  // o'zgartirmoqchi bo'lmasa, hech narsa yubormaymiz.
  useEffect(() => {
    if (adminAccount) {
      setLoginDraft(adminAccount.login);
    }
  }, [adminAccount]);

  const updateCredentialsMutation = useMutation({
    mutationFn: (payload: { login?: string; password?: string }) =>
      api.patch<{ login: string }>(`/platform/organizations/${organization.id}/admin`, payload),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["organization-admin", organization.id] });
      setPasswordDraft("");
      setCredentialsError(null);
      // Yangi parol shu yerda darhol ko'rinsin — foydalanuvchi uni WebAuthn
      // bilan qayta tasdiqlamasdan ko'chirib, kirish oynasiga kiritsin.
      if (variables.password) {
        setVisiblePassword(variables.password);
      }
    },
    onError: (err) => {
      setCredentialsError(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
    },
  });

  const handleSaveCredentials = () => {
    if (!adminAccount) return;
    const trimmedLogin = loginDraft.trim();
    const payload: { login?: string; password?: string } = {};
    if (trimmedLogin && trimmedLogin !== adminAccount.login) {
      payload.login = trimmedLogin;
    }
    if (passwordDraft) {
      if (passwordDraft.length < 8) {
        setCredentialsError("Parol kamida 8 ta belgidan iborat bo'lishi kerak");
        return;
      }
      payload.password = passwordDraft;
    }
    if (!payload.login && !payload.password) {
      setCredentialsError("Login yoki parolni o'zgartiring");
      return;
    }
    setCredentialsError(null);
    updateCredentialsMutation.mutate(payload);
  };

  const handleShowPassword = async () => {
    if (visiblePassword) {
      setVisiblePassword(null);
      return;
    }
    setRevealing(true);
    setRevealError(null);
    try {
      const { password } = await revealOrganizationAdminPassword(organization.id);
      setVisiblePassword(password);
    } catch (err) {
      setRevealError(webauthnErrorMessage(err));
    } finally {
      setRevealing(false);
    }
  };

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
        <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
          <p className="text-[13px] font-medium text-[var(--color-text)]">Kirish ma&apos;lumotlari</p>
          {!adminAccount ? (
            <p className="text-xs text-[var(--color-text-muted)]">Yuklanmoqda...</p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-sunken)] px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[12px] font-medium text-[var(--color-text-muted)]">Joriy parol</p>
                  <p className="truncate font-mono text-[15px] text-[var(--color-text)]">
                    {visiblePassword ?? "••••••••"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleShowPassword}
                  disabled={revealing}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[var(--color-primary)]/10 px-2.5 py-1.5 text-[12px] font-medium text-[var(--color-primary)] hover:bg-[var(--color-primary)]/[0.18] disabled:cursor-wait disabled:opacity-60"
                  aria-label={visiblePassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                >
                  {revealing ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  ) : visiblePassword ? (
                    <EyeOffIcon className="h-3.5 w-3.5" />
                  ) : (
                    <EyeIcon className="h-3.5 w-3.5" />
                  )}
                  {revealing ? "Tasdiqlanmoqda..." : visiblePassword ? "Yashirish" : "Ko'rsatish"}
                </button>
              </div>
              {revealError && <p className="text-xs text-[var(--color-danger)]">{revealError}</p>}

              <div className="space-y-3 border-t border-[var(--color-border)] pt-3">
                <p className="text-xs text-[var(--color-text-muted)]">Login yoki parolni qo&apos;lda o&apos;zgartirish</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input
                    label="Login"
                    type="text"
                    value={loginDraft}
                    onChange={(e) => setLoginDraft(e.target.value)}
                  />
                  <PasswordVeilInput
                    label="Yangi parol"
                    placeholder="O'zgartirmaslik uchun bo'sh qoldiring"
                    hint="Kamida 8 ta belgi"
                    value={passwordDraft}
                    onChange={(e) => setPasswordDraft(e.target.value)}
                  />
                </div>
                {credentialsError && <p className="text-xs text-[var(--color-danger)]">{credentialsError}</p>}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    loading={updateCredentialsMutation.isPending}
                    onClick={handleSaveCredentials}
                  >
                    Saqlash
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
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
