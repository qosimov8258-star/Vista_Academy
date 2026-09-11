"use client";

import { use, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api, ApiError } from "@/lib/api";
import type { Branch } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { LoadingState } from "@/components/ui/states";
import { ROLE_LABEL, canWriteOperational } from "@/lib/permissions";
import { MAX_UPLOAD_BYTES, resizeToSquare } from "@/lib/resize-image";
import { EditBranchModal } from "@/features/branches/edit-branch-modal";

const profileSchema = z.object({
  fullName: z.string().min(2, "To'liq ism kamida 2 belgi"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Joriy parolni kiriting"),
    newPassword: z.string().min(8, "Yangi parol kamida 8 belgi"),
    repeatPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.repeatPassword, {
    path: ["repeatPassword"],
    message: "Parollar mos kelmadi",
  });

type ProfileValues = z.infer<typeof profileSchema>;
type PasswordValues = z.infer<typeof passwordSchema>;


export default function SettingsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const queryClient = useQueryClient();
  const { user, isLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canEditBranch = canWriteOperational(user?.role) && !!user?.branchId;

  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [editBranchOpen, setEditBranchOpen] = useState(false);

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

  const removeAvatarMutation = useMutation({
    mutationFn: () => api.delete("/app/profile/avatar"),
    onSuccess: () => {
      setAvatarError(null);
      refreshUser();
    },
    onError: (err) => setAvatarError(err instanceof ApiError ? err.message : "Rasmni o'chirib bo'lmadi"),
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
    <div className="max-w-2xl space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--color-text)]">Sozlamalar</h1>
        <p className="text-[13px] text-[var(--color-text-muted)]">O&apos;z hisobingiz ma&apos;lumotlari</p>
      </div>

      {serverError && (
        <div className="rounded-[var(--radius-lg)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[13px] text-[var(--color-danger)]">
          {serverError}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar user={user} size={72} />
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[15px] font-medium text-[var(--color-text)]">{user.email}</span>
                <Badge tone="primary">{ROLE_LABEL[user.role]}</Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    void handleFile(e.target.files?.[0]);
                    // Bir xil faylni qayta tanlash ham hodisa bersin
                    e.target.value = "";
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  loading={avatarMutation.isPending}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {user.avatarUpdatedAt ? "Rasmni almashtirish" : "Rasm qo'yish"}
                </Button>
                {user.avatarUpdatedAt && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    loading={removeAvatarMutation.isPending}
                    onClick={() => removeAvatarMutation.mutate()}
                  >
                    O&apos;chirish
                  </Button>
                )}
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                JPG, PNG yoki WebP. Kvadrat qilib kesiladi va kichraytiriladi.
              </p>
              {avatarError && <p className="text-xs text-[var(--color-danger)]">{avatarError}</p>}
            </div>
          </div>

          <form
            className="space-y-4 border-t border-[var(--color-separator)] pt-5"
            onSubmit={profileForm.handleSubmit((values) => {
              setProfileMessage(null);
              profileMutation.mutate(values);
            })}
          >
            <Input
              label="To'liq ism"
              placeholder="Yusupova Dilnoza"
              error={profileForm.formState.errors.fullName?.message}
              {...profileForm.register("fullName")}
            />
            <div className="flex items-center gap-3">
              <Button type="submit" loading={profileMutation.isPending}>
                Saqlash
              </Button>
              {profileMessage && (
                <span className="text-[13px] text-[var(--color-success)]">{profileMessage}</span>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Parol</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            className="space-y-4"
            onSubmit={passwordForm.handleSubmit((values) => {
              setPasswordMessage(null);
              passwordMutation.mutate(values);
            })}
          >
            <Input
              label="Joriy parol"
              type="password"
              autoComplete="current-password"
              error={passwordForm.formState.errors.currentPassword?.message}
              {...passwordForm.register("currentPassword")}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Yangi parol"
                type="password"
                autoComplete="new-password"
                hint="Kamida 8 belgi"
                error={passwordForm.formState.errors.newPassword?.message}
                {...passwordForm.register("newPassword")}
              />
              <Input
                label="Yangi parolni takrorlang"
                type="password"
                autoComplete="new-password"
                error={passwordForm.formState.errors.repeatPassword?.message}
                {...passwordForm.register("repeatPassword")}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" loading={passwordMutation.isPending}>
                Parolni o&apos;zgartirish
              </Button>
              {passwordMessage && (
                <span className="text-[13px] text-[var(--color-success)]">{passwordMessage}</span>
              )}
            </div>
          </form>
        </CardBody>
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
