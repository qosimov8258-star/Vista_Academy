"use client";

import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import { openFile } from "@/lib/download";
import type { Group } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteTeaching } from "@/lib/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/states";
import { ViewOnlyNote } from "@/components/ui/view-only-note";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DocumentIcon, PlusIcon, TrashIcon } from "@/components/ui/icons";
import { formatDate } from "@/lib/format";
import { VoiceRecorder } from "@/features/group-materials/voice-recorder";
import { useTr } from "@/i18n/tr";

interface Material {
  id: string;
  title: string;
  description: string | null;
  kind: "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT";
  originalName: string;
  sizeBytes: number;
  createdByName: string;
  createdAt: string;
}

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/*,.mp3,.m4a,.ogg,.opus,.wav,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";
const KIND_LABEL: Record<Material["kind"], string> = { IMAGE: "Rasm", VIDEO: "Video", AUDIO: "Audio", DOCUMENT: "Hujjat" };

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/**
 * Guruh materiallari: tarbiyachi/o'qituvchi guruhga rasm, video yoki hujjat
 * yuklaydi — shu guruhdagi bolalarning ota-onalari kabinetdagi "Fayllar"
 * bo'limida ko'radi. O'qituvchi faqat o'z guruhlariga yuklay oladi (serverda ham).
 */
export default function MaterialsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [groupId, setGroupId] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Material | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  // Yozilgan (yoki tanlangan) ovozni yuborishdan oldin tinglab ko'rish
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const audioFile = files.length === 1 && files[0].type.startsWith("audio/") ? files[0] : null;
  useEffect(() => {
    if (!audioFile) return setPreviewUrl(null);
    const url = URL.createObjectURL(audioFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [audioFile]);

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<Group[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = groupsQuery.data ?? [];
  useEffect(() => {
    if (!groupId && groups.length > 0) setGroupId(groups[0].id);
  }, [groupId, groups]);

  const listQuery = useQuery({
    queryKey: ["group-materials", slug, groupId],
    queryFn: () => api.get<Material[]>(`/app/group-materials/groups/${groupId}`),
    enabled: !!groupId,
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      for (const file of files) {
        await api.upload(`/app/group-materials/groups/${groupId}`, file, {
          ...(files.length === 1 && title.trim() ? { title: title.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        });
      }
    },
    onSuccess: () => {
      setFiles([]);
      setTitle("");
      setDescription("");
      setFormError(null);
      if (fileInput.current) fileInput.current.value = "";
    },
    onError: (error) => setFormError(error instanceof ApiError ? error.message : tr("Yuklashda xatolik yuz berdi")),
    // Qisman yuklangan bo'lsa ham ro'yxat yangilansin
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["group-materials", slug, groupId] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/group-materials/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["group-materials", slug, groupId] });
      setDeleting(null);
    },
  });

  function pickFiles(list: FileList | File[] | null) {
    const picked = Array.from(list ?? []);
    const tooBig = picked.find((file) => file.size > MAX_BYTES);
    if (tooBig) {
      setFormError(tr("«{0}» 20 MB dan katta", tooBig.name));
      return;
    }
    setFormError(null);
    setFiles(picked);
  }

  const items = listQuery.data ?? [];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-bold tracking-[var(--tracking-headline)] text-[var(--color-text)]">{tr("Guruh fayllari")}</h1>
        <p className="mt-1 text-[15px] text-[var(--color-text-muted)]">
          {tr("Yuklangan rasm, video, ovoz va hujjatlarni shu guruh bolalarining ota-onalari kabinetda ko'radi")}
        </p>
      </div>

      {!canWrite && <ViewOnlyNote />}

      <Select label="Guruh" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
        {groups.map((group) => (
          <option key={group.id} value={group.id}>
            {group.name}
          </option>
        ))}
      </Select>

      {canWrite && groupId && (
        <Card className="space-y-4 p-5">
          <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => pickFiles(e.target.files)} />
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="secondary" onClick={() => fileInput.current?.click()}>
              <PlusIcon className="h-4 w-4" /> {tr("Fayl tanlash")}
            </Button>
            <VoiceRecorder
              onRecorded={(file) => {
                if (fileInput.current) fileInput.current.value = "";
                pickFiles([file]);
              }}
              onError={setFormError}
            />
            <span className="text-[14px] text-[var(--color-text-muted)]">
              {files.length === 0
                ? tr("Rasm, video, audio, PDF, Word, Excel — 20 MB gacha")
                : files.length === 1
                  ? files[0].name
                  : tr("{0} ta fayl tanlandi", String(files.length))}
            </span>
          </div>
          {files.length > 0 && (
            <>
              {previewUrl && (
                <div className="space-y-2">
                  <audio src={previewUrl} controls preload="metadata" className="w-full" />
                  <button
                    type="button"
                    onClick={() => pickFiles([])}
                    className="cursor-pointer text-[14px] font-medium text-[var(--color-danger)] active:opacity-60"
                  >
                    {tr("O'chirib, qayta yozish")}
                  </button>
                </div>
              )}
              {files.length === 1 && (
                <Input label="Sarlavha" value={title} maxLength={120} placeholder={tr("Bo'sh qoldirsangiz fayl nomi olinadi")} onChange={(e) => setTitle(e.target.value)} />
              )}
              <Textarea label="Izoh (ixtiyoriy)" value={description} maxLength={1000} onChange={(e) => setDescription(e.target.value)} />
              {formError && (
                <div role="alert" className="rounded-[var(--radius-md)] bg-[var(--color-danger-bg)] px-3.5 py-2.5 text-[14px] text-[var(--color-danger)]">
                  {formError}
                </div>
              )}
              <Button loading={uploadMutation.isPending} onClick={() => uploadMutation.mutate()}>
                {tr("Ota-onalarga yuborish")}
              </Button>
            </>
          )}
          {files.length === 0 && formError && <p className="text-[14px] text-[var(--color-danger)]">{formError}</p>}
        </Card>
      )}

      {openError && <ErrorState message={openError} />}

      {groupsQuery.isLoading || listQuery.isLoading ? (
        <LoadingState />
      ) : listQuery.isError ? (
        <ErrorState message={listQuery.error instanceof ApiError ? listQuery.error.message : tr("Yuklab bo'lmadi")} />
      ) : groups.length === 0 ? (
        <EmptyState title="Guruh yo'q" description="Sizga biriktirilgan guruh topilmadi" />
      ) : items.length === 0 ? (
        <EmptyState title="Hali fayl yuklanmagan" icon={<DocumentIcon className="h-[26px] w-[26px]" />} />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="flex items-start gap-4 p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="break-words text-[16px] font-semibold text-[var(--color-text)]">{item.title}</p>
                  <Badge>{tr(KIND_LABEL[item.kind])}</Badge>
                </div>
                {item.description && <p className="mt-1 whitespace-pre-line text-[14px] text-[var(--color-text-muted)]">{item.description}</p>}
                <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
                  {item.createdByName} · {formatDate(item.createdAt)} · {sizeLabel(item.sizeBytes)}
                </p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setOpenError(null);
                  openFile(`/app/group-materials/${item.id}/file`).catch((e) => setOpenError(e instanceof Error ? e.message : tr("Faylni ochib bo'lmadi")));
                }}
              >
                {tr("Ochish")}
              </Button>
              {canWrite && (
                <Button variant="dangerSoft" size="sm" isIconOnly aria-label={tr("O'chirish")} onClick={() => setDeleting(item)}>
                  <TrashIcon className="h-4 w-4" />
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        title="Faylni o'chirish"
        description={tr("«{0}» ota-onalar kabinetidan ham o'chadi.", deleting?.title ?? "")}
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.error instanceof ApiError ? deleteMutation.error.message : null}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
