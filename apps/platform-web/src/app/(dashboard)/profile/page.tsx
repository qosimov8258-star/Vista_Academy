"use client";

import { useEffect, useRef, useState, type ChangeEvent, type ComponentType, type SVGProps } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useAuth } from "@/lib/use-auth";
import { api, ApiError, assetUrl } from "@/lib/api";
import type { AuthenticatedUser } from "@/lib/types";
import { initials, roleLabel } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { LoadingState, ErrorState } from "@/components/ui/states";
import { CameraIcon, LogoutIcon, ShieldIcon, UserIcon } from "@/components/ui/icons";

type TabIcon = ComponentType<SVGProps<SVGSVGElement>>;
type TabId = "personal" | "security";

const TABS: { id: TabId; label: string; icon: TabIcon }[] = [
  { id: "personal", label: "Shaxsiy ma'lumot", icon: UserIcon },
  { id: "security", label: "Xavfsizlik", icon: ShieldIcon },
];

const LOGIN_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/;
const LOGIN_MESSAGE = "Login lotin harf, raqam, . _ - dan iborat bo'lishi va kamida 3 belgi bo'lishi kerak";

const profileSchema = z.object({
  login: z.string().trim().regex(LOGIN_PATTERN, LOGIN_MESSAGE),
  firstName: z.string().trim().min(1, "Ism kiritilishi shart").max(100),
  lastName: z.string().trim().min(1, "Familiya kiritilishi shart").max(100),
  phone: z.string().trim().max(20, "Ko'pi bilan 20 belgi").optional(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

function splitFullName(fullName: string) {
  const [first, ...rest] = fullName.trim().split(/\s+/);
  return { first: first ?? "", last: rest.join(" ") };
}

export default function ProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading, isError } = useAuth();
  const [tab, setTab] = useState<TabId>("personal");
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileSchema) });

  useEffect(() => {
    if (!user || initializedRef.current) return;
    initializedRef.current = true;
    const fallback = splitFullName(user.fullName);
    reset({
      login: user.login,
      firstName: user.firstName || fallback.first,
      lastName: user.lastName || fallback.last,
      phone: user.phone || "",
    });
  }, [user, reset]);

  const profileMutation = useMutation({
    mutationFn: (values: ProfileFormValues) => api.patch<{ user: AuthenticatedUser }>("/platform/auth/me", values),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      reset({
        login: data.user.login,
        firstName: data.user.firstName ?? "",
        lastName: data.user.lastName ?? "",
        phone: data.user.phone ?? "",
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    },
  });

  const avatarMutation = useMutation({
    mutationFn: (file: File) => api.upload<{ user: AuthenticatedUser }>("/platform/auth/me/avatar", file),
    onSuccess: (data) => {
      queryClient.setQueryData(["auth", "me"], data);
      setAvatarError(null);
    },
    onError: (err) => {
      setAvatarError(err instanceof ApiError ? err.message : "Rasmni yuklab bo'lmadi");
    },
  });

  const handleLogout = async () => {
    await api.post("/platform/auth/logout");
    // Keshni tozalamasak, keyingi kirgan foydalanuvchi bir zum oldingisining
    // ma'lumotini ko'radi.
    queryClient.clear();
    router.push("/login");
    router.refresh();
  };

  const handleAvatarPick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError("Rasm hajmi 5 MB dan oshmasligi kerak");
      return;
    }
    avatarMutation.mutate(file);
  };

  if (isLoading) return <LoadingState />;
  if (isError || !user) return <ErrorState message="Profil ma'lumotlarini yuklab bo'lmadi" />;

  const displayName = user.fullName || user.login;
  const avatarSrc = assetUrl(user.avatarUrl);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Profil"
        description="Hisob ma'lumotlaringiz"
        actions={
          <Button variant="danger" onClick={handleLogout}>
            <LogoutIcon className="h-4 w-4" />
            Chiqish
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[var(--color-primary)] to-[#ae6bb8] sm:h-28" />

        <div className="flex flex-col items-center px-5 pb-6 text-center">
          <div className="relative -mt-10">
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt=""
                className="h-20 w-20 rounded-full border-4 border-[var(--color-surface)] object-cover shadow-[var(--shadow-raised)]"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full border-4 border-[var(--color-surface)] bg-[var(--color-primary-soft)] text-[24px] font-semibold text-[var(--color-primary)] shadow-[var(--shadow-raised)]">
                {initials(displayName)}
              </span>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarMutation.isPending}
              aria-label="Rasmni o'zgartirish"
              title="Rasmni o'zgartirish"
              className="absolute bottom-0 right-0 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 border-[var(--color-surface)] bg-[var(--color-primary)] text-white shadow-[var(--shadow-card)] transition-transform duration-150 hover:bg-[var(--color-primary-hover)] active:scale-90 disabled:opacity-60"
            >
              {avatarMutation.isPending ? (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <CameraIcon className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarPick}
            />
          </div>
          {avatarError && <p className="mt-2 text-xs text-[var(--color-danger)]">{avatarError}</p>}
          <p className="mt-3 text-[17px] font-semibold text-[var(--color-text)]">{displayName}</p>
          <p className="text-[13px] text-[var(--color-text-muted)]">{user.login}</p>
          <Badge tone="primary" className="mt-2.5">
            {roleLabel(user.role)}
          </Badge>
        </div>

        <div className="flex flex-col border-t border-[var(--color-separator)] sm:flex-row">
          <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-[var(--color-separator)] p-2.5 sm:w-[210px] sm:flex-col sm:border-b-0 sm:border-r sm:p-3">
            {TABS.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex shrink-0 cursor-pointer items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-[14px] font-medium transition-colors duration-150",
                    active
                      ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text)]",
                  )}
                >
                  <Icon
                    className={clsx(
                      "h-[18px] w-[18px] shrink-0",
                      active ? "text-[var(--color-primary)]" : "text-[var(--color-text-subtle)]",
                    )}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 p-5">
            {tab === "personal" ? (
              <form className="space-y-4" onSubmit={handleSubmit((values) => profileMutation.mutate(values))}>
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-[var(--color-text)]">Shaxsiy ma&apos;lumot</p>
                  {savedNotice && (
                    <span className="text-[12px] font-medium text-[var(--color-success)]">Saqlandi</span>
                  )}
                </div>
                {profileMutation.isError && (
                  <div
                    role="alert"
                    className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3 py-2.5 text-[13px] text-[var(--color-danger)]"
                  >
                    {profileMutation.error instanceof ApiError
                      ? profileMutation.error.message
                      : "Kutilmagan xatolik yuz berdi"}
                  </div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Ism" error={errors.firstName?.message} {...register("firstName")} />
                  <Input label="Familiya" error={errors.lastName?.message} {...register("lastName")} />
                  <Input
                    label="Telefon raqam"
                    placeholder="+998901234567"
                    error={errors.phone?.message}
                    {...register("phone")}
                  />
                  <Input label="Login" type="text" error={errors.login?.message} {...register("login")} />
                  <Input label="Rol" value={roleLabel(user.role)} disabled readOnly className="sm:col-span-2" />
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" loading={isSubmitting || profileMutation.isPending} disabled={!isDirty}>
                    Saqlash
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-[15px] font-semibold text-[var(--color-text)]">Xavfsizlik</p>
                <div className="flex flex-col items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-surface-sunken)] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[14px] font-medium text-[var(--color-text)]">Tizimdan chiqish</p>
                    <p className="text-[12px] text-[var(--color-text-muted)]">
                      Joriy qurilmadagi sessiyangiz yakunlanadi
                    </p>
                  </div>
                  <Button variant="danger" onClick={handleLogout}>
                    <LogoutIcon className="h-4 w-4" />
                    Chiqish
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
