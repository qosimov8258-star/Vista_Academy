"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import type { Branch } from "@/lib/types";
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
  ClockIcon,
  CoinIcon,
  CopyIcon,
  GlobeIcon,
  KeyIcon,
  LockIcon,
  LogoutIcon,
  MoneyIcon,
  NoteIcon,
  UserIcon,
} from "@/components/ui/icons";
import { ROLE_LABEL, canWriteOperational } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, resizeToSquare } from "@/lib/resize-image";
import { EditBranchModal } from "@/features/branches/edit-branch-modal";
import { ThemePickerCard } from "@/features/settings/theme-picker-card";
import { SettingsGroup, SettingsRow, SettingsSheet } from "@/features/settings/settings-ui";

const profileSchema = z.object({
  fullName: z.string().trim().min(2, "To'liq ism kamida 2 belgi"),
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
type PasswordValues = z.infer<typeof passwordSchema>;
type Sheet = "name" | "password" | null;

const errorText = (err: unknown, fallback = "Kutilmagan xatolik") => (err instanceof ApiError ? err.message : fallback);

/**
 * Sozlamalar — iOS "Sozlamalar" ilovasi uslubida: tepada profil kartasi,
 * pastda guruhlangan ro'yxatlar (Hisob, Xavfsizlik, Ko'rinish, Filial).
 * Tahrirlash alohida oynada (telefonda pastdan chiqadi) — sahifaning o'zi
 * toza va o'qishli qoladi. Barcha rollar uchun umumiy sahifa.
 */
export default function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEditBranch = canWriteOperational(user?.role) && !!user?.branchId;

  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [editBranchOpen, setEditBranchOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const branchQuery = useQuery({
    queryKey: ["branch", slug, user?.branchId],
    queryFn: () => api.get<Branch>(`/app/organizations/me/branches/${user!.branchId}`),
    enabled: !!user?.branchId,
  });

  const profileForm = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    values: { fullName: user?.fullName ?? "" },
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
    setPasswordError(null);
    passwordForm.reset();
    profileForm.reset();
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

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      api.post("/app/profile/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      passwordForm.reset();
      setSheet(null);
      setToast({ type: "success", message: "Parol o'zgartirildi, boshqa qurilmalardagi seanslar yopildi" });
    },
    onError: (err) => setPasswordError(errorText(err)),
  });

  const avatarMutation = useMutation({
    mutationFn: (image: string) => api.put("/app/profile/avatar", { image }),
    onSuccess: () => {
      refreshUser();
      setToast({ type: "success", message: "Rasm yangilandi" });
    },
    onError: (err) => setToast({ type: "error", message: errorText(err, "Rasmni yuklab bo'lmadi") }),
  });

  const removeAvatarMutation = useMutation({
    mutationFn: () => api.delete("/app/profile/avatar"),
    onSuccess: () => {
      refreshUser();
      setToast({ type: "success", message: "Rasm olib tashlandi" });
    },
    onError: (err) => setToast({ type: "error", message: errorText(err, "Rasmni olib tashlab bo'lmadi") }),
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
      setToast({ type: "error", message: "Bu faylni rasm sifatida o'qib bo'lmadi" });
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

  const branch = branchQuery.data;
  const avatarBusy = avatarMutation.isPending || removeAvatarMutation.isPending;

  return (
    <div className="mx-auto w-full max-w-[720px] space-y-7 pb-4">
      <header>
        <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.025em] text-[var(--color-text)] md:text-[34px]">Sozlamalar</h1>
        <p className="mt-1 text-[14px] text-[var(--color-text-muted)]">Hisobingiz, xavfsizlik va panel ko&apos;rinishi</p>
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
              aria-label="Rasmni o'zgartirish"
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
            <p className="truncate text-[21px] font-bold tracking-[-0.015em] text-[var(--color-text)]">{user.fullName}</p>
            <p className="truncate text-[14px] text-[var(--color-text-muted)]">
              {ROLE_LABEL[user.role]} · {user.organizationName}
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
              {user.avatarUpdatedAt ? "Rasmni almashtirish" : "Rasm qo'yish"}
            </button>
            {user.avatarUpdatedAt && (
              <button
                type="button"
                onClick={() => removeAvatarMutation.mutate()}
                disabled={avatarBusy}
                className="h-9 cursor-pointer rounded-full bg-[var(--color-surface-sunken)] px-4 text-[14px] font-semibold text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-danger)] disabled:opacity-60"
              >
                Olib tashlash
              </button>
            )}
          </div>
        </div>
      </section>

      <SettingsGroup title="Hisob">
        <SettingsRow first icon={UserIcon} label="To'liq ism" value={user.fullName} onClick={() => setSheet("name")} />
        <SettingsRow
          icon={KeyIcon}
          label="Login"
          value={user.login}
          trailing={
            <button
              type="button"
              onClick={copyLogin}
              aria-label="Loginni nusxalash"
              className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-black/[0.05] hover:text-[var(--color-text)]"
            >
              {copied ? <CheckIcon className="h-4 w-4 text-[var(--color-success)]" /> : <CopyIcon className="h-4 w-4" />}
            </button>
          }
        />
        <SettingsRow icon={BriefcaseIcon} label="Rol" value={ROLE_LABEL[user.role]} />
      </SettingsGroup>

      <SettingsGroup title="Xavfsizlik" footer="Parol o'zgartirilganda boshqa qurilmalardagi barcha seanslar yopiladi.">
        <SettingsRow first icon={LockIcon} label="Parolni o'zgartirish" onClick={() => setSheet("password")} />
      </SettingsGroup>

      <ThemePickerCard />

      {user.branchId && (
        <SettingsGroup
          title="Filial"
          action={
            canEditBranch && branch ? (
              <button
                type="button"
                onClick={() => setEditBranchOpen(true)}
                className="cursor-pointer text-[15px] font-medium text-[var(--color-primary)] active:opacity-60"
              >
                Tahrirlash
              </button>
            ) : undefined
          }
        >
          {branchQuery.isLoading ? (
            <div className="p-4">
              <LoadingState rows={2} />
            </div>
          ) : branch ? (
            <>
              <SettingsRow first icon={BuildingIcon} label="Nomi" value={branch.name} />
              <SettingsRow icon={NoteIcon} label="Manzil" value={branch.address || "—"} />
              <SettingsRow
                icon={ClockIcon}
                label="Ish vaqti"
                value={branch.openTime && branch.closeTime ? `${branch.openTime} — ${branch.closeTime}` : "—"}
              />
              <SettingsRow
                icon={MoneyIcon}
                label="Oylik to'lov"
                value={
                  branch.defaultTuitionAmount
                    ? `${Number(branch.defaultTuitionAmount).toLocaleString("ru-RU").replace(/ /g, " ")} ${branch.currency}`
                    : "—"
                }
              />
              <SettingsRow icon={CoinIcon} label="Valyuta" value={branch.currency} />
              <SettingsRow icon={GlobeIcon} label="Vaqt zonasi" value={branch.timezone} />
            </>
          ) : null}
        </SettingsGroup>
      )}

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
      <SettingsSheet open={sheet === "name"} onClose={closeSheet} title="To'liq ism">
        <form
          className="space-y-4"
          onSubmit={profileForm.handleSubmit((values) => {
            setNameError(null);
            profileMutation.mutate(values);
          })}
        >
          <div className="rounded-[20px] bg-[var(--color-surface)] p-4">
            <Input
              label="Ism va familiya"
              placeholder="Yusupova Dilnoza"
              autoFocus
              error={profileForm.formState.errors.fullName?.message}
              {...profileForm.register("fullName")}
            />
            <p className="mt-2 text-[13px] text-[var(--color-text-muted)]">Hamkasblaringiz va hisobotlarda shu ism ko&apos;rinadi.</p>
          </div>
          {nameError && <p className="px-1 text-[13px] text-[var(--color-danger)]">{nameError}</p>}
          <Button type="submit" size="lg" fullWidth loading={profileMutation.isPending}>
            Saqlash
          </Button>
        </form>
      </SettingsSheet>

      {/* Parol */}
      <SettingsSheet open={sheet === "password"} onClose={closeSheet} title="Parolni o'zgartirish">
        <form
          className="space-y-4"
          onSubmit={passwordForm.handleSubmit((values) => {
            setPasswordError(null);
            passwordMutation.mutate(values);
          })}
        >
          <div className="space-y-4 rounded-[20px] bg-[var(--color-surface)] p-4">
            <PasswordInput
              label="Joriy parol"
              autoComplete="current-password"
              autoFocus
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register("currentPassword")}
            />
            <PasswordInput
              label="Yangi parol"
              autoComplete="new-password"
              error={passwordForm.formState.errors.newPassword?.message}
              {...passwordForm.register("newPassword")}
            />
            <PasswordInput
              label="Yangi parolni takrorlang"
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
          {passwordError && <p className="px-1 text-[13px] text-[var(--color-danger)]">{passwordError}</p>}
          <Button type="submit" size="lg" fullWidth loading={passwordMutation.isPending}>
            Parolni o&apos;zgartirish
          </Button>
        </form>
      </SettingsSheet>

      {canEditBranch && editBranchOpen && branch && (
        <EditBranchModal open={editBranchOpen} onClose={() => setEditBranchOpen(false)} slug={slug} branch={branch} />
      )}

      <Toast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
