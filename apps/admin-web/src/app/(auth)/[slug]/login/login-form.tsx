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
import { ArrowRight, Eye, EyeOff, LockKeyhole, UserRound } from "lucide-react";
import { Spinner } from "@/components/ios/spinner";
import type { TenantAuthenticatedUser } from "@/lib/types";
import { useTr } from "@/i18n/tr";

/** `inputClassName` / `submitClassName` — maydon va tugmaning sahifaga xos ko'rinishi */
export function LoginForm({ slug, inputClassName, submitClassName }: { slug: string; inputClassName?: string; submitClassName?: string }) {
  const tr = useTr();
  const [showPassword, setShowPassword] = useState(false);
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
      const next = safeNextPath(searchParams.get("next")) ?? defaultDestination;
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {serverError && (
        <div role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.07] px-4 py-3 text-[14px] leading-snug text-[#d70015]">
          {tr(serverError)}
        </div>
      )}

      <label htmlFor="login" className="block">
        <span className="mb-2 block text-[13px] font-medium text-[#3c3c43]">{t("loginLabel")}</span>
        <span className="group relative block">
          <UserRound className={iconClass} strokeWidth={2} aria-hidden="true" />
          <input
            id="login"
            type="text"
            placeholder={t("loginPlaceholder")}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            aria-invalid={errors.login ? true : undefined}
            className={inputClassName}
            {...register("login")}
          />
        </span>
        {errors.login?.message && <span className="mt-1.5 block text-[13px] text-[#ff3b30]">{tr(errors.login.message)}</span>}
      </label>

      <label htmlFor="password" className="block">
        <span className="mb-2 block text-[13px] font-medium text-[#3c3c43]">{t("passwordLabel")}</span>
        <span className="group relative block">
          <LockKeyhole className={iconClass} strokeWidth={2} aria-hidden="true" />
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
            className={clsx(inputClassName, "pr-12!")}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? tr("Parolni yashirish") : tr("Parolni ko'rsatish")}
            aria-pressed={showPassword}
            className="absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-[11px] text-[#a1a1a6] transition-colors hover:bg-black/[0.04] hover:text-[#0c0c0c]"
          >
            {showPassword ? <EyeOff className="h-[18px] w-[18px]" strokeWidth={2} /> : <Eye className="h-[18px] w-[18px]" strokeWidth={2} />}
          </button>
        </span>
        {errors.password?.message && <span className="mt-1.5 block text-[13px] text-[#ff3b30]">{tr(errors.password.message)}</span>}
      </label>

      <button
        type="submit"
        disabled={isSubmitting}
        className={clsx("group mt-3 flex h-[52px] w-full items-center justify-center gap-2 rounded-[14px] text-[15.5px] font-semibold disabled:opacity-70", submitClassName)}
      >
        {isSubmitting ? (
          <Spinner className="h-5 w-5 text-white" />
        ) : (
          <>
            {t("submit")}
            <ArrowRight className="h-[18px] w-[18px] transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.2} aria-hidden="true" />
          </>
        )}
      </button>
    </form>
  );
}

/** Maydon chetidagi ikonka: fokusda qorayadi */
const iconClass =
  "pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#a1a1a6] transition-colors group-focus-within:text-[#a3143a]";

/**
 * `?next=` faqat shu saytdagi yo'l bo'lishi mumkin ("/..." lekin "//" yoki "/\\"
 * emas) — aks holda login havolasi orqali foydalanuvchini begona saytga
 * yo'naltirib yuborish (phishing) mumkin edi.
 */
function safeNextPath(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return null;
  return next;
}
