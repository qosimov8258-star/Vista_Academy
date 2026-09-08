"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertIcon } from "@/components/ui/icons";
import type { AuthenticatedUser } from "@/lib/types";

const schema = z.object({
  email: z.string().email("Email formati noto'g'ri"),
  password: z.string().min(8, "Kamida 8 belgi"),
});

type FormValues = z.infer<typeof schema>;

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      await api.post<{ user: AuthenticatedUser }>("/platform/auth/login", values);
      const next = searchParams.get("next") ?? "/";
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
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-card)]"
    >
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]"
        >
          <AlertIcon className="mt-px h-4 w-4 shrink-0" />
          {serverError}
        </div>
      )}
      <Input
        id="email"
        label="Email"
        type="email"
        placeholder="admin@bogcha.uz"
        autoComplete="username"
        error={errors.email?.message}
        {...register("email")}
      />
      <Input
        id="password"
        label="Parol"
        type="password"
        placeholder="••••••••"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register("password")}
      />
      <Button type="submit" className="mt-1 w-full" loading={isSubmitting}>
        Kirish
      </Button>
    </form>
  );
}
