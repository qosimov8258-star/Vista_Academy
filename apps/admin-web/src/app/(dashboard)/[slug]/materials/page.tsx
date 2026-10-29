"use client";

import { use, useEffect, useRef, useState, type ComponentType } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Film, ImageIcon, Mic, Paperclip, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { fetchFileUrl, openFile } from "@/lib/download";
import type { Group as GroupModel } from "@/lib/types";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";
import { canWriteTeaching, isTeacher } from "@/lib/permissions";
import { CheckIcon, type IconProps } from "@/components/ios/icons";
import { IOS, SECTION_TITLE } from "@/components/ios/tokens";
import { IosSheet, SheetPrimaryButton, SheetRow, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { EmptyRow, Group, LargeTitle, PrimaryButton, Row, SkeletonRows, TeacherPage, formatDayShort } from "@/features/teacher/teacher-ui";
import { GuideRow, GuideSheet } from "@/features/teacher/guide-sheet";
import { GUIDE_VIDEOS } from "@/features/teacher/guides";
import { ADD_BUTTON, TILE, VoiceRecorder } from "@/features/group-materials/voice-recorder";
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
/** Bir yuborishda — har biri alohida vazifa bo'lib tushadi */
const MAX_FILES = 10;
const ACCEPT = "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,audio/*,.mp3,.m4a,.ogg,.opus,.wav,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt";

const KIND: Record<Material["kind"], { label: string; color: string; icon: ComponentType<IconProps> }> = {
  IMAGE: { label: "Rasm", color: IOS.blue, icon: ImageIcon },
  VIDEO: { label: "Video", color: "#af52de", icon: Film },
  AUDIO: { label: "Audio", color: IOS.orange, icon: Mic },
  DOCUMENT: { label: "Hujjat", color: IOS.gray, icon: FileText },
};

function fileKind(file: File): Material["kind"] {
  if (file.type.startsWith("audio/")) return "AUDIO";
  if (file.type.startsWith("image/")) return "IMAGE";
  if (file.type.startsWith("video/")) return "VIDEO";
  return "DOCUMENT";
}

function sizeLabel(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Ro'yxatdagi tur plitkasi — iOS uslubida tekis rang + oq belgi */
function KindTile({ kind, size = 36 }: { kind: Material["kind"]; size?: number }) {
  const meta = KIND[kind];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-[10px]" style={{ width: size, height: size, backgroundColor: meta.color }} aria-hidden="true">
      <meta.icon className="text-white" style={{ width: size / 2, height: size / 2 }} strokeWidth={2.2} />
    </span>
  );
}

/**
 * Vazifa jo'natish (guruh fayllari): tarbiyachi/o'qituvchi guruhga rasm,
 * video, ovozli vazifa yoki hujjat yuboradi — shu guruh bolalarining
 * ota-onalari kabinetdagi "Fayllar" bo'limida ko'radi. O'qituvchi faqat o'z
 * guruhlariga yuklay oladi (serverda ham). iOS uslubida, telefon uchun.
 */
export default function MaterialsPage({ params }: { params: Promise<{ slug: string }> }) {
  const tr = useTr();
  const { slug } = use(params);
  const { user } = useAuth();
  const canWrite = canWriteTeaching(user?.role);
  const teacher = isTeacher(user?.role);
  const { branchId: forcedBranchId } = useBranchContext(slug);
  const queryClient = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [groupId, setGroupId] = useState("");
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [opened, setOpened] = useState<Material | null>(null);

  const groupsQuery = useQuery({
    queryKey: ["groups", slug, forcedBranchId],
    queryFn: () => api.get<GroupModel[]>(`/app/groups${forcedBranchId ? `?branchId=${forcedBranchId}` : ""}`),
  });
  const groups = groupsQuery.data ?? [];
  useEffect(() => {
    if (!groupId && groups.length > 0) setGroupId(groups[0].id);
  }, [groupId, groups]);
  const currentGroup = groups.find((g) => g.id === groupId);

  const listQuery = useQuery({
    queryKey: ["group-materials", slug, groupId],
    queryFn: () => api.get<Material[]>(`/app/group-materials/groups/${groupId}`),
    enabled: !!groupId,
  });
  const items = listQuery.data ?? [];

  const resetDraft = () => {
    setFiles([]);
    setTitle("");
    setDescription("");
    setFormError(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      for (const file of files) {
        await api.upload(`/app/group-materials/groups/${groupId}`, file, {
          ...(files.length === 1 && title.trim() ? { title: title.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
        });
      }
    },
    onSuccess: resetDraft,
    onError: (error) => setFormError(error instanceof ApiError ? error.message : tr("Yuklashda xatolik yuz berdi")),
    // Qisman yuklangan bo'lsa ham ro'yxat yangilansin
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["group-materials", slug, groupId] }),
  });

  // Ovoz yozuvi tugaganda chaqiriladigan funksiya yozish boshlangan paytdagi
  // holatni ko'radi — oraliqda fayl o'chirilgan bo'lishi mumkin, shuning uchun ref
  const filesRef = useRef(files);
  filesRef.current = files;

  /** Tanlangan/yozilgan fayllar qoralamaga QO'SHILADI — avvalgilari o'chmaydi */
  function pickFiles(list: FileList | File[] | null) {
    const files = filesRef.current;
    const picked = Array.from(list ?? []);
    if (fileInput.current) fileInput.current.value = "";
    if (picked.length === 0) return;
    const tooBig = picked.find((file) => file.size > MAX_BYTES);
    if (tooBig) {
      setFormError(tr("«{0}» 20 MB dan katta", tooBig.name));
      return;
    }
    const fresh = picked.filter((file) => !files.some((f) => f.name === file.name && f.size === file.size));
    if (files.length + fresh.length > MAX_FILES) {
      setFormError(tr("Bir martada {0} tagacha fayl yuboriladi", MAX_FILES));
      return;
    }
    setFormError(null);
    setFiles([...files, ...fresh]);
  }

  function removeFile(index: number) {
    setFormError(null);
    setFiles(files.filter((_, i) => i !== index));
  }

  // Yuborishdan oldin ko'rish: rasm — kichik surat, ovoz — shu qatorning o'zida tinglash
  const [previews, setPreviews] = useState<Map<File, string>>(new Map());
  useEffect(() => {
    const map = new Map<File, string>();
    for (const file of files) {
      const kind = fileKind(file);
      if (kind === "IMAGE" || kind === "AUDIO") map.set(file, URL.createObjectURL(file));
    }
    setPreviews(map);
    return () => map.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  const single = files.length === 1 ? files[0] : null;
  const singleImage = single && fileKind(single) === "IMAGE" ? previews.get(single) : undefined;

  return (
    <TeacherPage className="pb-4">
      <LargeTitle
        title={tr(teacher ? "Vazifa jo'natish" : "Guruh fayllari")}
        subtitle={tr("Rasm, video, ovoz va hujjatlarni guruh bolalarining ota-onalari kabinetda ko'radi")}
      />

      <GuideRow title="Vazifa jo'natish yo'riqnomasi" subtitle="Qanday yuborish — 1 daqiqada" onOpen={() => setGuideOpen(true)} />

      {/* Guruh — bitta bo'lsa shunchaki ko'rinadi, ko'p bo'lsa pastdan ro'yxat ochiladi */}
      <Group footer={!canWrite ? tr("Siz faqat ko'rasiz — yuborish tarbiyachi va administratorniki.") : undefined}>
        {groupsQuery.isLoading ? (
          <SkeletonRows rows={1} />
        ) : groups.length === 0 ? (
          <EmptyRow title={tr("Guruh yo'q")} description={tr("Sizga biriktirilgan guruh topilmadi")} />
        ) : (
          <Row
            first
            title={tr("Guruh")}
            value={currentGroup ? tr(currentGroup.name) : "—"}
            onClick={groups.length > 1 ? () => setGroupPickerOpen(true) : undefined}
          />
        )}
      </Group>

      {canWrite && groupId && (
        <section>
          <h2 className={SECTION_TITLE}>{tr("Yangi vazifa")}</h2>
          <input ref={fileInput} type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => pickFiles(e.target.files)} />

          {files.length === 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {!recording && (
                <button type="button" onClick={() => fileInput.current?.click()} className={TILE}>
                  <span className="flex h-11 w-11 items-center justify-center rounded-full" style={{ backgroundColor: `${IOS.blue}1f`, color: IOS.blue }}>
                    <Paperclip className="h-[22px] w-[22px]" strokeWidth={2.2} />
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--color-text)]">{tr("Fayl tanlash")}</span>
                </button>
              )}
              <VoiceRecorder onRecorded={(file) => pickFiles([file])} onError={setFormError} onRecordingChange={setRecording} />
              {!recording && <p className="col-span-2 px-1 text-[13px] text-[#8e8e93]">{tr("Rasm, video, audio, PDF, Word, Excel — 20 MB gacha")}</p>}
              {formError && <p className="col-span-2 px-1 text-[13px] text-[#ff3b30]">{formError}</p>}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="overflow-hidden rounded-[18px] bg-white">
                {singleImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={singleImage} alt="" className="max-h-[260px] w-full object-cover" />
                )}
                {files.map((file, i) => {
                  const kind = fileKind(file);
                  const url = previews.get(file);
                  return (
                    <div key={`${file.name}-${file.size}`} className="relative py-2 pl-4 pr-1">
                      {i > 0 && <span className="absolute left-[60px] right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
                      <div className="flex min-h-[40px] items-center gap-3">
                        {kind === "IMAGE" && url && !singleImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={url} alt="" className="h-8 w-8 shrink-0 rounded-[8px] object-cover" />
                        ) : (
                          <KindTile kind={kind} size={32} />
                        )}
                        <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--color-text)]">{file.name}</span>
                        <span className="shrink-0 text-[13px] tabular-nums text-[#8e8e93]">{sizeLabel(file.size)}</span>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          disabled={uploadMutation.isPending}
                          aria-label={tr("Olib tashlash")}
                          className="flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center active:opacity-50 disabled:opacity-40"
                        >
                          <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#767680]/[0.16]">
                            <X className="h-3.5 w-3.5 text-[#8e8e93]" strokeWidth={3} />
                          </span>
                        </button>
                      </div>
                      {kind === "AUDIO" && url && <audio src={url} controls preload="metadata" className="mb-1 mt-1.5 h-10 w-[calc(100%-12px)]" />}
                    </div>
                  );
                })}
              </div>

              {/* Ustiga qo'shish: yana fayl yoki yana ovozli xabar */}
              {files.length < MAX_FILES && !uploadMutation.isPending && (
                <div className="grid grid-cols-2 gap-3">
                  {!recording && (
                    <button type="button" onClick={() => fileInput.current?.click()} className={ADD_BUTTON}>
                      <Paperclip className="h-5 w-5" style={{ color: IOS.blue }} strokeWidth={2.2} />
                      {tr("Yana fayl")}
                    </button>
                  )}
                  <VoiceRecorder compact onRecorded={(file) => pickFiles([file])} onError={setFormError} onRecordingChange={setRecording} />
                </div>
              )}

              <div className="overflow-hidden rounded-[18px] bg-white">
                {files.length === 1 && (
                  <input
                    value={title}
                    maxLength={120}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={tr("Sarlavha — masalan: «She'r yodlash, dushanbagacha»")}
                    className="h-[52px] w-full border-b border-black/[0.08] bg-transparent px-4 text-[16px] text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]"
                  />
                )}
                <textarea
                  value={description}
                  maxLength={1000}
                  rows={3}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={tr("Izoh (ixtiyoriy)")}
                  className="block w-full resize-none bg-transparent px-4 py-3 text-[16px] leading-snug text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]"
                />
              </div>
              {files.length > 1 && <p className="px-1 text-[13px] text-[#8e8e93]">{tr("Bir nechta fayl — har biri o'z nomi bilan yuboriladi")}</p>}
              {formError && <p className="px-1 text-[13px] text-[#ff3b30]">{formError}</p>}

              <PrimaryButton loading={uploadMutation.isPending} disabled={recording} onClick={() => uploadMutation.mutate()}>
                {tr("Ota-onalarga yuborish")}
              </PrimaryButton>
              <button
                type="button"
                disabled={uploadMutation.isPending}
                onClick={resetDraft}
                className="block w-full cursor-pointer py-2 text-center text-[15px] font-medium text-[#ff3b30] active:opacity-60 disabled:opacity-40"
              >
                {tr(files.length > 1 ? "Hammasini bekor qilish" : "Bekor qilish")}
              </button>
            </div>
          )}
        </section>
      )}

      {groupId && (
        <Group title={tr("Yuborilganlar")} action={items.length > 0 ? <span className="text-[13px] tabular-nums text-[#8e8e93]">{items.length}</span> : undefined}>
          {listQuery.isLoading ? (
            <SkeletonRows rows={3} />
          ) : listQuery.isError ? (
            <EmptyRow title={tr("Yuklab bo'lmadi")} description={listQuery.error instanceof ApiError ? listQuery.error.message : undefined} />
          ) : items.length === 0 ? (
            <EmptyRow icon={FileText} title={tr("Hali vazifa yuborilmagan")} description={canWrite ? tr("Yuqoridan fayl tanlang yoki ovoz yozing") : undefined} />
          ) : (
            items.map((item, i) => (
              <Row
                key={item.id}
                first={i === 0}
                leading={<KindTile kind={item.kind} />}
                title={item.title}
                subtitle={`${tr(KIND[item.kind].label)} · ${item.createdByName} · ${formatDayShort(item.createdAt.slice(0, 10))} · ${sizeLabel(item.sizeBytes)}`}
                onClick={() => setOpened(item)}
              />
            ))
          )}
        </Group>
      )}

      <GuideSheet
        open={guideOpen}
        onClose={() => setGuideOpen(false)}
        intro="Vazifa, rasm, video yoki ovozli xabarni guruhdagi barcha ota-onalarga bir bosishda yuboring."
        steps={[
          { title: "Guruhni tekshiring", text: "Bir nechta guruhingiz bo'lsa, «Guruh» qatorini bosib kerakli guruhni tanlang." },
          { title: "Fayl tanlang yoki ovoz yozing", text: "«Fayl tanlash» — rasm, video yoki hujjat. «Ovoz yozish» — vazifani o'zingiz ovoz bilan aytib bering.", token: <KindTile kind="AUDIO" size={28} /> },
          { title: "Ovoz yozish", text: "Gapirib bo'lgach qizil kvadrat tugmani bosing. Yuborishdan oldin tinglab ko'rasiz; yoqmasa — yonidagi × bilan olib tashlang. «Yana fayl» yoki «Yana ovoz» bilan ustiga qo'shish mumkin." },
          { title: "Sarlavha va izoh", text: "Masalan: «She'r yodlash — dushanbagacha». Kerak bo'lsa izohga qo'shimcha tushuntirish yozing." },
          { title: "«Ota-onalarga yuborish»", text: "Vazifa shu guruh bolalarining ota-onalari kabinetidagi «Fayllar» bo'limida darhol paydo bo'ladi." },
        ]}
        tip="Maslahat: yuborilgan vazifani bossangiz — ochib ko'rish yoki o'chirish mumkin. O'chirilsa, ota-onalar kabinetidan ham o'chadi."
        videoUrl={GUIDE_VIDEOS.materials}
      />

      {/* Guruh tanlash */}
      <IosSheet open={groupPickerOpen} onClose={() => setGroupPickerOpen(false)} cancelLabel="Yopish" title={tr("Guruh")}>
        <div className="overflow-hidden rounded-[18px] bg-white">
          {groups.map((group, i) => (
            <button
              key={group.id}
              type="button"
              onClick={() => {
                setGroupId(group.id);
                resetDraft();
                setGroupPickerOpen(false);
              }}
              className="relative flex min-h-[52px] w-full cursor-pointer items-center justify-between px-4 text-left text-[16px] text-[var(--color-text)] active:bg-black/[0.04]"
            >
              {i > 0 && <span className="absolute left-4 right-0 top-0 h-px bg-black/[0.08]" aria-hidden="true" />}
              {tr(group.name)}
              {group.id === groupId && <CheckIcon className="h-5 w-5 text-[var(--color-primary)]" strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      </IosSheet>

      <MaterialSheet
        material={opened}
        canWrite={canWrite}
        onClose={() => setOpened(null)}
        onDeleted={() => {
          setOpened(null);
          queryClient.invalidateQueries({ queryKey: ["group-materials", slug, groupId] });
        }}
      />
    </TeacherPage>
  );
}

/**
 * Yuborilgan vazifa varag'i: ovozni shu yerning o'zida tinglash, rasm/videoni
 * ko'rish, hujjatni ochish; tarbiyachida — ikki bosqichli o'chirish.
 */
function MaterialSheet({ material, canWrite, onClose, onDeleted }: { material: Material | null; canWrite: boolean; onClose: () => void; onDeleted: () => void }) {
  const tr = useTr();
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const filePath = material ? `/app/group-materials/${material.id}/file` : "";
  const inline = !!material && material.kind !== "DOCUMENT";

  // Media himoyalangan — token bilan yuklab, shu yerda ko'rsatamiz
  useEffect(() => {
    setConfirming(false);
    setOpenError(null);
    setMediaError(null);
    setMediaUrl(null);
    if (!inline) return;
    let url: string | null = null;
    let cancelled = false;
    fetchFileUrl(filePath)
      .then((u) => {
        if (cancelled) return URL.revokeObjectURL(u);
        url = u;
        setMediaUrl(u);
      })
      .catch(() => !cancelled && setMediaError(tr("Faylni ochib bo'lmadi")));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [material?.id]);

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/app/group-materials/${material!.id}`),
    onSuccess: onDeleted,
  });

  return (
    <IosSheet
      open={!!material}
      onClose={() => !deleteMutation.isPending && onClose()}
      cancelLabel="Yopish"
      title={material ? material.title : ""}
      footer={
        material &&
        (confirming ? (
          <div className="flex gap-2">
            <div className="flex-1">
              <SheetSecondaryButton onClick={() => setConfirming(false)}>{tr("Qoldirish")}</SheetSecondaryButton>
            </div>
            <div className="flex-1">
              <SheetSecondaryButton danger onClick={() => !deleteMutation.isPending && deleteMutation.mutate()}>
                {tr(deleteMutation.isPending ? "O'chirilmoqda…" : "O'chirish")}
              </SheetSecondaryButton>
            </div>
          </div>
        ) : material.kind === "DOCUMENT" ? (
          <SheetPrimaryButton
            onClick={() => {
              setOpenError(null);
              openFile(filePath).catch((e) => setOpenError(e instanceof Error ? e.message : tr("Faylni ochib bo'lmadi")));
            }}
          >
            {tr("Ochish")}
          </SheetPrimaryButton>
        ) : undefined)
      }
    >
      {material && (
        <div className="space-y-5">
          {inline && (
            <div className="overflow-hidden rounded-[18px] bg-white">
              {mediaError ? (
                <p className="px-4 py-6 text-center text-[14px] text-[#ff3b30]">{mediaError}</p>
              ) : !mediaUrl ? (
                <div className="h-24 animate-pulse bg-black/[0.04]" />
              ) : material.kind === "AUDIO" ? (
                <div className="flex items-center gap-3 p-4">
                  <KindTile kind="AUDIO" size={44} />
                  <audio src={mediaUrl} controls preload="metadata" onError={() => setMediaError(tr("Faylni ochib bo'lmadi"))} className="min-w-0 flex-1" />
                </div>
              ) : material.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt={material.title} onError={() => setMediaError(tr("Faylni ochib bo'lmadi"))} className="max-h-[360px] w-full object-contain" />
              ) : (
                <video src={mediaUrl} controls playsInline preload="metadata" onError={() => setMediaError(tr("Faylni ochib bo'lmadi"))} className="max-h-[360px] w-full bg-black" />
              )}
            </div>
          )}

          {material.description && <p className="whitespace-pre-line px-1 text-[15px] leading-relaxed text-[var(--color-text)]">{material.description}</p>}

          <SheetSection>
            <SheetRow label={tr("Turi")}>
              <span style={{ color: KIND[material.kind].color }}>{tr(KIND[material.kind].label)}</span>
            </SheetRow>
            <SheetRow label={tr("Yubordi")}>{material.createdByName}</SheetRow>
            <SheetRow label={tr("Sana")}>{formatDayShort(material.createdAt.slice(0, 10))}</SheetRow>
            <SheetRow label={tr("Hajmi")}>{sizeLabel(material.sizeBytes)}</SheetRow>
          </SheetSection>

          {openError && <p className="px-4 text-[13px] text-[#ff3b30]">{openError}</p>}

          {confirming ? (
            <p className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[14px] leading-snug text-[#d70015]">
              {tr("«{0}» ota-onalar kabinetidan ham o'chadi. Buni qaytarib bo'lmaydi.", material.title)}
            </p>
          ) : (
            canWrite && (
              <SheetSecondaryButton danger onClick={() => setConfirming(true)}>
                {tr("Vazifani o'chirish")}
              </SheetSecondaryButton>
            )
          )}
          {deleteMutation.isError && (
            <p className="px-4 text-[13px] text-[#ff3b30]">{deleteMutation.error instanceof ApiError ? deleteMutation.error.message : tr("O'chirib bo'lmadi")}</p>
          )}
        </div>
      )}
    </IosSheet>
  );
}
