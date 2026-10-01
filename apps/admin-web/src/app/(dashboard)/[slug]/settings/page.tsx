"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/use-auth";
import { clearTenantTokens, getTenantRefreshToken } from "@/lib/tenant-session";
import { Input, PasswordInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { LoadingState } from "@/components/ui/states";
import { Toast, type ToastState } from "@/components/ui/toast";
import { PasswordChecklist, getPasswordRules } from "@/components/ui/password-checklist";
import {
  BriefcaseIcon,
  BuildingIcon,
  CameraIcon,
  CheckIcon,
  CopyIcon,
  KeyIcon,
  LockIcon,
  LogoutIcon,
  UserIcon,
} from "@/components/ui/icons";
import { ROLE_LABEL, isTeacher } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, resizeToSquare } from "@/lib/resize-image";
import { ThemePickerCard } from "@/features/settings/theme-picker-card";
import { SettingsGroup, SettingsPlainIcons, SettingsRow, SettingsSheet } from "@/features/settings/settings-ui";
import { useTr } from "@/i18n/tr";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "To'liq ism kamida 2 belgi"),
});

const orgNameSchema = z.object({
  name: z.string().trim().min(2, "Nom kamida 2 belgi"),
});

const loginSchema = z.object({
  login: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9._-]{1,30}[A-Za-z0-9]$/, "Login lotin harf, raqam, . _ - dan iborat bo'lishi va kamida 3 belgi bo'lishi kerak"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Joriy parolni kiriting"),
    newPassword: z.string(),
    repeatPassword: z.string(),
  })
  .superRefine((values, ctx) => {
    const unmet = getPasswordRules(values.newPassword).some((rule) => !rule.met);
    if (unmet) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: "Parol talablarga javob bermaydi" });
    }
    if (values.newPassword !== values.repeatPassword) {
      ctx.addIssue({ code: "custom", path: ["repeatPassword"], message: "Parollar mos kelmadi" });
    }
  });

type ProfileValues = z.infer<typeof profileSchema>;
type OrgNameValues = z.infer<typeof orgNameSchema>;
type LoginValues = z.infer<typeof loginSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;
type Sheet = "name" | "orgName" | "security" | null;

const errorText = (err: unknown, fallback = "Kutilmagan xatolik") => (err instanceof ApiError ? err.message : fallback);

/**
 * Sozlamalar — iOS "Sozlamalar" ilovasi uslubida: tepada profil kartasi,
 * pastda guruhlangan ro'yxatlar (Hisob, Xavfsizlik, Ko'rinish).
 * Barcha rollar uchun umumiy sahifa.
 */
export default function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [orgNameError, setOrgNameError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: { fullName: user?.fullName ?? "" },
  });

  const orgNameForm = useForm<OrgNameValues>({
    resolver: zodResolver(orgNameSchema),
    values: { name: user?.organizationName ?? "" },
  });

  const loginForm = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    values: { login: user?.login ?? "" },
  });

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: { currentPassword: "", newPassword: "", repeatPassword: "" },
  });
  const newPassword = passwordForm.watch("newPassword");
  const repeatPassword = passwordForm.watch("repeatPassword");
  const passwordRules = getPasswordRules(newPassword ?? "", repeatPassword ?? "");

  const refreshUser = () => queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
  const closeSheet = () => {
    setSheet(null);
    setNameError(null);
    setOrgNameError(null);
    setLoginError(null);
    setPasswordError(null);
    passwordForm.reset();
    profileForm.reset();
    orgNameForm.reset();
    loginForm.reset();
  };

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues) => api.patch("/app/profile", values),
    onSuccess: () => {
      refreshUser();
      setSheet(null);
      setToast({ type: "success", message: "Ism saqlandi" });
    },
    onError: (err) => setNameError(errorText(err)),
  });

  const orgNameMutation = useMutation({
    mutationFn: (values: OrgNameValues) => api.patch("/app/organizations/me", values),
    onSuccess: () => {
      refreshUser();
      queryClient.invalidateQueries({ queryKey: ["org", slug] });
      setSheet(null);
      setToast({ type: "success", message: tr("Logo nomi saqlandi") });
    },
    onError: (err) => setOrgNameError(errorText(err)),
  });

  const loginMutation = useMutation({
    mutationFn: (values: LoginValues) => api.post("/app/profile/login", values),
    onSuccess: () => {
      refreshUser();
      setLoginError(null);
      setToast({ type: "success", message: tr("Login o'zgartirildi") });
    },
    onError: (err) => setLoginError(errorText(err)),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      api.post("/app/profile/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      passwordForm.reset();
      setSheet(null);
      setToast({ type: "success", message: tr("Parol o'zgartirildi, boshqa qurilmalardagi seanslar yopildi") });
    },
    onError: (err) => setPasswordError(errorText(err)),
  });

  const avatarMutation = useMutation({
    mutationFn: (image: string) => api.put("/app/profile/avatar", { image }),
    onSuccess: () => {
      refreshUser();
      setToast({ type: "success", message: "Rasm yangilandi" });
    },
    onError: (err) => setToast({ type: "error", message: errorText(err, tr("Rasmni yuklab bo'lmadi")) }),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => api.delete("/app/profile/avatar"),
    onSuccess: () => {
      refreshUser();
      setToast({ type: "success", message: "Rasm olib tashlandi" });
    },
    onError: (err) => setToast({ type: "error", message: errorText(err, tr("Rasmni olib tashlab bo'lmadi")) }),
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setToast({ type: "error", message: "Rasm juda katta (8 MB gacha)" });
      return;
    }
    try {
      avatarMutation.mutate(await resizeToSquare(file));
    } catch {
      setToast({ type: "error", message: tr("Bu faylni rasm sifatida o'qib bo'lmadi") });
    }
  };

  const copyLogin = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(user.login);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Brauzer ruxsat bermadi — login baribir ko'rinib turibdi
    }
  };

  // Yon paneldagi "Chiqish" bilan bir xil: kesh ham tozalanadi, aks holda
  // shu brauzerda keyin kirgan boshqa foydalanuvchiga eski ma'lumot ko'rinardi
  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await api.post("/app/auth/logout", { refreshToken: getTenantRefreshToken() });
    } finally {
      clearTenantTokens();
      queryClient.clear();
      router.push(`/${slug}/login`);
      router.refresh();
    }
  };

  if (isLoading) return <LoadingState />;
  if (!user) return null;

  const avatarBusy = avatarMutation.isPending || removeAvatarMutation.isPending;

  return (
    // Tarbiyachi kabinetida ikonkalar rangli fonsiz — tizim rangidagi oddiy belgilar
    <SettingsPlainIcons enabled={isTeacher(user?.role)}>
      <div className="mx-auto w-full max-w-[720px] space-y-7 pb-4">
        <header>
          <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.025em] text-[var(--color-text)] md:text-[34px]">{tr("Sozlamalar")}</h1>
          <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">{tr("Hisobingiz, xavfsizlik va panel ko'rinishi")}</p>
        </header>

        {/* Profil — iOS'dagi Apple ID kartasi kabi */}
        <section className="overflow-hidden rounded-[28px] bg-[var(--color-surface)] shadow-[0_1px_2px_rgba(16,24,40,0.04),0_8px_24px_-14px_rgba(16,24,40,0.14)]">
          <div
            className="h-24 transition-colors duration-300 sm:h-28"
            style={{
              background:
                "radial-gradient(120% 160% at 100% 0%, color-mix(in srgb, var(--accent-bright) 45%, transparent), transparent 60%), linear-gradient(135deg, var(--accent-rail-2), var(--accent-rail))",
            }}
            aria-hidden="true"
          />
          <div className="flex flex-col items-center px-5 pb-6 text-center sm:flex-row sm:items-end sm:gap-5 sm:text-left">
            <div className="relative -mt-12 shrink-0">
              <Avatar user={user} size={96} className="border-4 border-[var(--color-surface)] shadow-[var(--shadow-raised)]" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                aria-label={tr("Rasmni o'zgartirish")}
                className="absolute bottom-1 right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-[3px] border-[var(--color-surface)] bg-[var(--color-primary)] text-white shadow-[var(--shadow-card)] transition-transform duration-150 hover:bg-[var(--color-primary-hover)] active:scale-90 disabled:opacity-60"
              >
                {avatarBusy ? (
                  <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : (
                  <CameraIcon className="h-4 w-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  void handleFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <div className="mt-3 min-w-0 flex-1 sm:mt-0 sm:pb-1">
              <p className="truncate text-[21px] font-bold tracking-[-0.015em] text-[var(--color-text)]">{tr(user.fullName)}</p>
              <p className="truncate text-[14px] text-[var(--color-text-muted)]">
                {tr(ROLE_LABEL[user.role])} · {tr(user.organizationName)}
                {user.branchName ? ` · ${user.branchName}` : ""}
              </p>
            </div>
            <div className="mt-4 flex gap-2 sm:mt-0 sm:pb-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarBusy}
                className="h-9 cursor-pointer rounded-full bg-[var(--color-primary)]/10 px-4 text-[14px] font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/15 disabled:opacity-60"
              >
                {user.avatarUpdatedAt ? "Rasmni almashtirish" : tr("Rasm qo'yish")}
              </button>
              {user.avatarUpdatedAt && (
                <button
                  type="button"
                  onClick={() => removeAvatarMutation.mutate()}
                  disabled={avatarBusy}
                  className="h-9 cursor-pointer rounded-full bg-[var(--color-surface-sunken)] px-4 text-[14px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-60"
                >
                  {tr("Olib tashlash")}
                </button>
              )}
            </div>
          </div>
        </section>

        <SettingsGroup title={tr("Hisob")}>
          <SettingsRow first icon={UserIcon} label={tr("To'liq ism")} value={user.fullName} onClick={() => setSheet("name")} />
          <SettingsRow
            icon={KeyIcon}
            label={tr("Login")}
            value={user.login}
            trailing={
              <button
                type="button"
                onClick={copyLogin}
                aria-label={tr("Loginni nusxalash")}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text)]"
              >
                {copied ? <CheckIcon className="h-4 w-4 text-[var(--color-success)]" /> : <CopyIcon className="h-4 w-4" />}
              </button>
            }
          />
          <SettingsRow icon={BriefcaseIcon} label={tr("Rol")} value={ROLE_LABEL[user.role]} />
        </SettingsGroup>

        {(user.role === "NETWORK_ADMIN" || user.role === "BRANCH_ADMIN") && (
          <SettingsGroup
            title={tr("Logo")}
            footer={tr("Bu nom butun panelda — yon menyu, kirish sahifasi, xodim va bola qo'shish oynalarida ko'rinadi.")}
          >
            <SettingsRow first icon={BuildingIcon} label={tr("Bog'cha nomi")} value={user.organizationName} onClick={() => setSheet("orgName")} />
          </SettingsGroup>
        )}

        <SettingsGroup title={tr("Xavfsizlik")} footer={tr("Parol o'zgartirilganda boshqa qurilmalardagi barcha seanslar yopiladi.")}>
          <SettingsRow first icon={LockIcon} label={tr("Login va parolni o'zgartirish")} onClick={() => setSheet("security")} />
        </SettingsGroup>

        <ThemePickerCard />

        <SettingsGroup>
          <SettingsRow
            first
            icon={LogoutIcon}
            danger
            label={loggingOut ? "Chiqilmoqda…" : "Tizimdan chiqish"}
            onClick={logout}
          />
        </SettingsGroup>

        {/* Ism */}
        <SettingsSheet open={sheet === "name"} onClose={closeSheet} title={tr("To'liq ism")}>
          <form
            className="space-y-4"
            onSubmit={profileForm.handleSubmit((values) => {
              setNameError(null);
              profileMutation.mutate(values);
            })}
          >
            <div className="rounded-[20px] bg-[var(--color-surface)] p-4">
              <Input
                label={tr("Ism va familiya")}
                placeholder={tr("Yusupova Dilnoza")}
                autoFocus
                error={profileForm.formState.errors.fullName?.message}
                {...profileForm.register("fullName")}
              />
              <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">{tr("Hamkasblaringiz va hisobotlarda shu ism ko'rinadi.")}</p>
            </div>
            {nameError && <p className="px-1 text-[13px] text-[var(--color-danger)]">{tr(nameError)}</p>}
            <Button type="submit" size="lg" fullWidth loading={profileMutation.isPending}>
              {tr("Saqlash")}
            </Button>
          </form>
        </SettingsSheet>

        {/* Logo (bog'cha nomi) */}
        <SettingsSheet open={sheet === "orgName"} onClose={closeSheet} title={tr("Logo")}>
          <form
            className="space-y-4"
            onSubmit={orgNameForm.handleSubmit((values) => {
              setOrgNameError(null);
              orgNameMutation.mutate(values);
            })}
          >
            <div className="rounded-[20px] bg-[var(--color-surface)] p-4">
              <Input
                label={tr("Bog'cha nomi")}
                placeholder={tr("Masalan, Vista Academy")}
                autoFocus
                error={orgNameForm.formState.errors.name?.message ? tr(orgNameForm.formState.errors.name.message) : undefined}
                {...orgNameForm.register("name")}
              />
              <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">
                {tr("Yon menyu, kirish sahifasi va oynalarda shu nom yashil rangda ko'rinadi.")}
              </p>
            </div>
            {orgNameError && <p className="px-1 text-[13px] text-[var(--color-danger)]">{tr(orgNameError)}</p>}
            <Button type="submit" size="lg" fullWidth loading={orgNameMutation.isPending}>
              {tr("Saqlash")}
            </Button>
          </form>
        </SettingsSheet>

        {/* Login va parol */}
        <SettingsSheet open={sheet === "security"} onClose={closeSheet} title={tr("Login va parolni o'zgartirish")}>
          <div className="space-y-7">
            <div>
              <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{tr("Login")}</h3>
              <form
                className="space-y-4"
                onSubmit={loginForm.handleSubmit((values) => {
                  setLoginError(null);
                  loginMutation.mutate(values);
                })}
              >
                <div className="rounded-[20px] bg-[var(--color-surface)] p-4">
                  <Input
                    label={tr("Login")}
                    autoFocus
                    error={loginForm.formState.errors.login?.message}
                    {...loginForm.register("login")}
                  />
                </div>
                {loginError && <p className="px-1 text-[13px] text-[var(--color-danger)]">{tr(loginError)}</p>}
                <Button type="submit" size="lg" fullWidth loading={loginMutation.isPending}>
                  {tr("Loginni saqlash")}
                </Button>
              </form>
            </div>

            <div>
              <h3 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]">{tr("Parol")}</h3>
              <form
                className="space-y-4"
                onSubmit={passwordForm.handleSubmit((values) => {
                  setPasswordError(null);
                  passwordMutation.mutate(values);
                })}
              >
                <div className="space-y-4 rounded-[20px] bg-[var(--color-surface)] p-4">
                  <PasswordInput
                    label={tr("Joriy parol")}
                    autoComplete="current-password"
                    error={passwordForm.formState.errors.currentPassword?.message}
                    {...passwordForm.register("currentPassword")}
                  />
                  <PasswordInput
                    label={tr("Yangi parol")}
                    autoComplete="new-password"
                    error={passwordForm.formState.errors.newPassword?.message}
                    {...passwordForm.register("newPassword")}
                  />
                  <PasswordInput
                    label={tr("Yangi parolni takrorlang")}
                    autoComplete="new-password"
                    error={passwordForm.formState.errors.repeatPassword?.message}
                    {...passwordForm.register("repeatPassword")}
                  />
                </div>
                {newPassword && (
                  <div className="rounded-[20px] bg-[var(--color-surface)] p-4">
                    <PasswordChecklist rules={passwordRules} />
                  </div>
                )}
                {passwordError && <p className="px-1 text-[13px] text-[var(--color-danger)]">{tr(passwordError)}</p>}
                <Button type="submit" size="lg" fullWidth loading={passwordMutation.isPending}>
                  {tr("Parolni o'zgartirish")}
                </Button>
              </form>
            </div>
          </div>
        </SettingsSheet>

        <Toast toast={toast} onDismiss={() => setToast(null)} />
      </div>
    </SettingsPlainIcons>
  );
}
