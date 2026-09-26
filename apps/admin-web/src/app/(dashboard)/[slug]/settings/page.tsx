"use client";

import { use, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { Branch } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { LoadingState } from "@/components/ui/states";
import { PasswordChecklist, getPasswordRules } from "@/components/ui/password-checklist";
import { CameraIcon, EyeIcon, EyeOffIcon, LockIcon, UserIcon } from "@/components/ui/icons";
import { ROLE_LABEL, canWriteOperational } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, resizeToSquare } from "@/lib/resize-image";
import { EditBranchModal } from "@/features/branches/edit-branch-modal";
import { ChefLogoutCard } from "@/features/chef/chef-logout-card";

type TabId = "personal" | "security";

const TABS: { id: TabId; label: string; icon: typeof UserIcon }[] = [
  { id: "personal", label: "Shaxsiy ma'lumot", icon: UserIcon },
  { id: "security", label: "Xavfsizlik", icon: LockIcon },
];

const profileSchema = z.object({
  fullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
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

export default function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEditBranch = canWriteOperational(user?.role) && !!user?.branchId;

  const [tab, setTab] = useState<TabId>("personal");
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [editBranchOpen, setEditBranchOpen] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showRepeatPassword, setShowRepeatPassword] = useState(false);

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

  const profileMutation = useMutation({
    mutationFn: (values: ProfileValues) => api.patch("/app/profile", values),
    onSuccess: () => {
      setServerError(null);
      setProfileMessage("Saqlandi");
      refreshUser();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const passwordMutation = useMutation({
    mutationFn: (values: PasswordValues) =>
      api.post("/app/profile/password", {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      }),
    onSuccess: () => {
      setServerError(null);
      setPasswordMessage("Parol o'zgartirildi. Boshqa qurilmalardagi seanslar yopildi.");
      passwordForm.reset();
    },
    onError: (err) => setServerError(err instanceof ApiError ? err.message : "Kutilmagan xatolik"),
  });

  const avatarMutation = useMutation({
    mutationFn: (image: string) => api.put("/app/profile/avatar", { image }),
    onSuccess: () => {
      setAvatarError(null);
      refreshUser();
    },
    onError: (err) => setAvatarError(err instanceof ApiError ? err.message : "Rasmni yuklab bo'lmadi"),
  });

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setAvatarError("Rasm juda katta (8 MB gacha)");
      return;
    }
    try {
      const image = await resizeToSquare(file);
      avatarMutation.mutate(image);
    } catch {
      setAvatarError("Bu faylni rasm sifatida o'qib bo'lmadi");
    }
  };

  if (isLoading) return <LoadingState />;
  if (!user) return null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--color-text)]">Sozlamalar</h1>
        <p className="text-[13px] text-[var(--color-text-muted)]">O&apos;z hisobingiz ma&apos;lumotlari</p>
      </div>

      {serverError && (
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[13px] text-[var(--color-danger)]">
          {serverError}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-[var(--color-primary)] to-[#ae6bb8] sm:h-28" />

        <div className="flex flex-col items-center px-5 pb-6 text-center">
          <div className="relative -mt-10">
            <Avatar user={user} size={80} className="border-4 border-[var(--color-surface)] shadow-[var(--shadow-raised)]" />
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
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
          {avatarError && <p className="mt-2 text-xs text-[var(--color-danger)]">{avatarError}</p>}
          <p className="mt-3 text-[17px] font-semibold text-[var(--color-text)]">{user.fullName}</p>
          <p className="text-[13px] text-[var(--color-text-muted)]">{user.login}</p>
          <Badge tone="primary" className="mt-2.5">
            {ROLE_LABEL[user.role]}
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
                      ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]",
                  )}
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 p-5">
            {tab === "personal" ? (
              <form
                className="space-y-4"
                onSubmit={profileForm.handleSubmit((values) => {
                  setProfileMessage(null);
                  profileMutation.mutate(values);
                })}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-[var(--color-text)]">Shaxsiy ma&apos;lumot</p>
                  {profileMessage && (
                    <span className="text-[12px] font-medium text-[var(--color-success)]">{profileMessage}</span>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input
                    label="To'liq ism"
                    placeholder="Yusupova Dilnoza"
                    error={profileForm.formState.errors.fullName?.message}
                    {...profileForm.register("fullName")}
                  />
                  <Input label="Login" value={user.login} disabled readOnly />
                  <Input label="Rol" value={ROLE_LABEL[user.role]} disabled readOnly className="sm:col-span-2" />
                </div>
                <div className="flex justify-end pt-1">
                  <Button type="submit" loading={profileMutation.isPending}>
                    Saqlash
                  </Button>
                </div>
              </form>
            ) : (
              <form
                className="space-y-4"
                onSubmit={passwordForm.handleSubmit((values) => {
                  setPasswordMessage(null);
                  passwordMutation.mutate(values);
                })}
              >
                <div className="flex items-center justify-between">
                  <p className="text-[15px] font-semibold text-[var(--color-text)]">Xavfsizlik</p>
                  {passwordMessage && (
                    <span className="text-[12px] font-medium text-[var(--color-success)]">{passwordMessage}</span>
                  )}
                </div>
                <div className="relative">
                  <Input
                    label="Joriy parol"
                    type={showCurrentPassword ? "text" : "password"}
                    autoComplete="current-password"
                    error={passwordForm.formState.errors.currentPassword?.message}
                    {...passwordForm.register("currentPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword((v) => !v)}
                    className="absolute right-3 top-[38px] cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
                    aria-label={showCurrentPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                  >
                    {showCurrentPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="relative">
                    <Input
                      label="Yangi parol"
                      type={showNewPassword ? "text" : "password"}
                      autoComplete="new-password"
                      error={passwordForm.formState.errors.newPassword?.message}
                      {...passwordForm.register("newPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((v) => !v)}
                      className="absolute right-3 top-[38px] cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
                      aria-label={showNewPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    >
                      {showNewPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                  <div className="relative">
                    <Input
                      label="Yangi parolni takrorlang"
                      type={showRepeatPassword ? "text" : "password"}
                      autoComplete="new-password"
                      error={passwordForm.formState.errors.repeatPassword?.message}
                      {...passwordForm.register("repeatPassword")}
                    />
                    <button
                      type="button"
                      onClick={() => setShowRepeatPassword((v) => !v)}
                      className="absolute right-3 top-[38px] cursor-pointer text-gray-400 hover:text-[var(--color-text)]"
                      aria-label={showRepeatPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
                    >
                      {showRepeatPassword ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {newPassword && (
                  <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] p-3">
                    <PasswordChecklist rules={passwordRules} />
                  </div>
                )}
                <div className="flex justify-end pt-1">
                  <Button type="submit" loading={passwordMutation.isPending}>
                    Parolni o&apos;zgartirish
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </Card>

      {user.branchId && (
        <Card>
          <CardHeader className="flex items-center justify-between gap-3">
            <CardTitle>Filial ma&apos;lumotlari</CardTitle>
            {canEditBranch && (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditBranchOpen(true)}>
                Tahrirlash
              </Button>
            )}
          </CardHeader>
          <CardBody>
            {branchQuery.isLoading ? (
              <LoadingState rows={2} />
            ) : branchQuery.data ? (
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Nomi</dt>
                  <dd className="mt-0.5 text-[14px] text-[var(--color-text)]">{branchQuery.data.name}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Manzil</dt>
                  <dd className="mt-0.5 text-[14px] text-[var(--color-text)]">{branchQuery.data.address || "—"}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Vaqt zonasi</dt>
                  <dd className="mt-0.5 text-[14px] text-[var(--color-text)]">{branchQuery.data.timezone}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Valyuta</dt>
                  <dd className="mt-0.5 text-[14px] text-[var(--color-text)]">{branchQuery.data.currency}</dd>
                </div>
                <div>
                  <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Ish vaqti</dt>
                  <dd className="mt-0.5 text-[14px] text-[var(--color-text)]">
                    {branchQuery.data.openTime && branchQuery.data.closeTime
                      ? `${branchQuery.data.openTime} — ${branchQuery.data.closeTime}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[12px] font-medium text-[var(--color-text-muted)]">Standart oylik to&apos;lov</dt>
                  <dd className="mt-0.5 text-[14px] text-[var(--color-text)]">
                    {branchQuery.data.defaultTuitionAmount
                      ? `${Number(branchQuery.data.defaultTuitionAmount).toLocaleString("uz-UZ")} ${branchQuery.data.currency}`
                      : "—"}
                  </dd>
                </div>
              </dl>
            ) : null}
          </CardBody>
        </Card>
      )}

      <ChefLogoutCard slug={slug} />

      {canEditBranch && editBranchOpen && branchQuery.data && (
        <EditBranchModal
          open={editBranchOpen}
          onClose={() => setEditBranchOpen(false)}
          slug={slug}
          branch={branchQuery.data}
        />
      )}
    </div>
  );
}
