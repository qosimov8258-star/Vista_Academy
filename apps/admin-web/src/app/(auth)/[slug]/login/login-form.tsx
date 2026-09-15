"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { setTenantTokens } from "@/lib/tenant-session";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { TenantAuthenticatedUser } from "@/lib/types";

const schema = z.object({
  login: z.string().min(1, "Login kiritilishi shart"),
  password: z.string().min(8, "Kamida 8 belgi"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm({ slug }: { slug: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

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
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError("Kutilmagan xatolik yuz berdi");
      }
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {serverError && (
        <div role="alert" className="rounded-xl bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-sm text-[var(--color-danger)]">
          {serverError}
        </div>
      )}
      <Input
        id="login"
        label="Login"
        type="text"
        placeholder="admin_tarmoq"
        autoComplete="username"
        className="h-11 rounded-xl px-3.5"
        error={errors.login?.message}
        {...register("login")}
      />
      <Input
        id="password"
        label="Parol"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        className="h-11 rounded-xl px-3.5"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" size="lg" fullWidth className="mt-2" loading={isSubmitting}>
        Kirish
      </Button>
    </form>
  );
}
