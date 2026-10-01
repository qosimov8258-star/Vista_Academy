"use client";

import { useState } from "react";
import clsx from "clsx";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { parentApi } from "@/lib/parent-api";
import { setTenantTokens } from "@/lib/tenant-session";
import { Input, PasswordInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LockIcon } from "@/components/ui/icons";
import type { TenantAuthenticatedUser } from "@/lib/types";
import { useTr } from "@/i18n/tr";

/** `submitClassName` — kirish tugmasining sahifaga xos ko'rinishi (gradient) */
export function LoginForm({ slug, submitClassName }: { slug: string; submitClassName?: string }) {
  const tr = useTr();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const t = useTranslations("login");
  const [serverError, setServerError] = useState<string | null>(null);

  const schema = z.object({
    login: z.string().min(1, t("loginRequired")),
    // Uzunlikni server tekshiradi: xodim paroli 8+, ota-onaniki 6+ belgi
    password: z.string().min(1, t("passwordRequired")),
  });
  type FormValues = z.infer<typeof schema>;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  /**
   * Bitta forma hamma uchun: avval xodim sifatida, bo'lmasa (kiritilgani
   * telefon raqamiga o'xshasa) ota-ona sifatida kiriladi. Ota-ona logini —
   * bolaga biriktirilgan telefon raqami.
   */
  const tryParentLogin = async (values: FormValues): Promise<boolean> => {
    const digits = values.login.replace(/\D/g, "");
    if (!/^[\d\s()+-]+$/.test(values.login.trim()) || digits.length < 7) return false;
    try {
      await parentApi.post("/app/parent/login", { orgSlug: slug, phone: values.login.trim(), password: values.password });
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return false;
      throw err;
    }
    queryClient.clear();
    router.push(`/ota-ona/${slug}`);
    router.refresh();
    return true;
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const { user, accessToken, refreshToken } = await api.post<{
        user: TenantAuthenticatedUser;
        accessToken: string;
        refreshToken: string;
      }>("/app/auth/login", {
        orgSlug: slug,
        ...values,
      });
      // Shu tab uchun mustaqil token — boshqa tabda boshqa foydalanuvchi kirsa ham,
      // bu tab o'zining sessionStorage'idagi tokeni bilan ishlashda davom etadi.
      setTenantTokens({ accessToken, refreshToken });
      // Kesh foydalanuvchiga emas, tashkilot slug'iga bog'langan (["auth","me"] va h.k.) —
      // "Chiqish" bosmasdan shu tabda boshqa hisobga kirilsa (masalan, Super Admin filial
      // admini yaratib, uni sinash uchun darhol qayta login qilsa), eski foydalanuvchining
      // roli 30 soniyagacha keshda "fresh" turib qolib, yangi hisobning yozish tugmalari
      // (Yangi xodim, Tovar qo'shish) ko'rinmay qolardi. Logout'dagi bilan bir xil tozalash.
      queryClient.clear();
      const defaultDestination = user.branchSlug ? `/${slug}/${user.branchSlug}` : `/${slug}`;
      const next = searchParams.get("next") ?? defaultDestination;
      router.push(next);
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        try {
          if (await tryParentLogin(values)) return;
        } catch (parentErr) {
          setServerError(parentErr instanceof ApiError ? parentErr.message : t("unexpectedError"));
          return;
        }
      }
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError(t("unexpectedError"));
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {serverError && (
        <div role="alert" className="rounded-xl bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]">
          {tr(serverError)}
        </div>
      )}
      <Input
        id="login"
        label={t("loginLabel")}
        type="text"
        placeholder={t("loginPlaceholder")}
        autoComplete="username"
        error={errors.login?.message}
        {...register("login")}
      />
      <PasswordInput
        id="password"
        label={t("passwordLabel")}
        placeholder="••••••••"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button
        type="submit"
        size="lg"
        fullWidth
        className={clsx("mt-3 rounded-[16px]! text-[16px]! font-bold! text-[var(--accent-orb-ink)]!", submitClassName)}
        loading={isSubmitting}
      >
        {!isSubmitting && <LockIcon className="h-[18px] w-[18px]" />}
        {t("submit")}
      </Button>
    </form>
  );
}
