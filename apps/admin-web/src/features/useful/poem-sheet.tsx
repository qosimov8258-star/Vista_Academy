"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Group, Poem, UsefulStatus } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FormSection } from "@/components/ios/form";
import { useTr } from "@/i18n/tr";
import { splitIntoBlocks } from "./split-blocks";
import {
  AgeRangeRow,
  FormError,
  GroupPickerRow,
  InputRow,
  PublishRow,
  ReadingCard,
  TextBlock,
  WritePreviewToggle,
  publishFooter,
} from "./useful-parts";

const RECOMMENDED_LINE_LENGTH = 45;

/** She'r — ota-onalar ko'radigan ko'rinishda (bandlar, qatorlar) */
export function PoemReading({ title, author, stanzas }: { title: string; author?: string | null; stanzas: string[][] }) {
  const tr = useTr();
  return (
    <ReadingCard>
      <div className="text-center">
        <p className="text-[20px] font-bold leading-tight text-[var(--color-text)]">{title ? tr(title) : tr("Sarlavha")}</p>
        {author && <p className="mt-1 text-[14px] text-[#8e8e93]">{tr(author)}</p>}
      </div>
      {stanzas.length === 0 ? (
        <p className="text-center text-[14px] text-[#8e8e93]">{tr("Matn kiritilgach shu yerda ko'rinadi")}</p>
      ) : (
        stanzas.map((stanza, i) => (
          <p key={i} className="text-center text-[17px] leading-[1.6] text-[var(--color-text)]">
            {stanza.map((line, j) => (
              <span key={j}>
                {tr(line)}
                {j < stanza.length - 1 && <br />}
              </span>
            ))}
          </p>
        ))
      )}
    </ReadingCard>
  );
}

/** Yangi she'r / tahrirlash — iOS varag'i */
export function PoemSheet({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  poem,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  /** O'qituvchi uchun guruh majburiy, boshqalar "Butun filial"ni ham tanlay oladi */
  isTeacher: boolean;
  poem: Poem | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const isEdit = !!poem;

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [groupId, setGroupId] = useState("");
  const [ageFrom, setAgeFrom] = useState(3);
  const [ageTo, setAgeTo] = useState(6);
  const [text, setText] = useState("");
  const [status, setStatus] = useState<UsefulStatus>("PUBLISHED");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(poem?.title ?? "");
    setAuthor(poem?.author ?? "");
    setGroupId(poem?.groupId ?? "");
    setAgeFrom(poem?.ageFrom ?? 3);
    setAgeTo(poem?.ageTo ?? 6);
    setText(poem ? poem.stanzas.map((s) => s.join("\n")).join("\n\n") : "");
    setStatus(poem?.status ?? "PUBLISHED");
    setMode("write");
    setTried(false);
  }, [open, poem]);

  // Tarbiyachining bitta guruhi bo'lsa — o'zi tanlanadi (guruhlar keyinroq yuklansa ham)
  const onlyGroupId = isTeacher && groups.length === 1 ? groups[0].id : "";
  useEffect(() => {
    if (open && onlyGroupId) setGroupId((current) => current || onlyGroupId);
  }, [open, onlyGroupId]);

  const stanzas = useMemo(() => splitIntoBlocks(text), [text]);
  const hasLongLine = stanzas.some((s) => s.some((line) => line.length > RECOMMENDED_LINE_LENGTH));

  const errors = {
    title: !title.trim() ? "Sarlavhani kiriting" : undefined,
    group: isTeacher && !groupId ? "Guruhni tanlang" : undefined,
    text: !text.trim() ? "Matnni kiriting" : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (key: keyof typeof errors) => (tried ? errors[key] : undefined);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        author: author.trim() || null,
        groupId: groupId || null,
        ageFrom,
        ageTo,
        text,
        status,
      };
      return isEdit ? api.patch<Poem>(`/app/useful/poems/${poem!.id}`, payload) : api.post<Poem>("/app/useful/poems", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-poems", slug] });
      onClose();
    },
  });
  const { reset } = save;
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const submit = () => {
    setTried(true);
    if (!valid) {
      // Matn xato bo'lsa — yozish rejimiga qaytaramiz, xato ko'rinsin
      if (errors.text) setMode("write");
      return;
    }
    if (!save.isPending) save.mutate();
  };

  return (
    <IosSheet
      open={open}
      onClose={() => !save.isPending && onClose()}
      title={tr(isEdit ? "She'rni tahrirlash" : "Yangi she'r")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={save.isPending} dim={!valid}>
          {tr(isEdit ? "Saqlash" : "Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <FormSection>
        <InputRow label="Sarlavha" value={title} onChange={setTitle} placeholder="Quyoshcha" maxLength={80} error={show("title")} />
        <InputRow label="Muallif" value={author} onChange={setAuthor} placeholder="Ixtiyoriy" maxLength={80} />
      </FormSection>

      <section className="space-y-2">
        <WritePreviewToggle value={mode} onChange={setMode} />
        {mode === "write" ? (
          <FormSection
            footer={
              hasLongLine ? (
                <span className="text-[#ff9500]">
                  {tr("Ba'zi qatorlar {0} belgidan uzun — rasmda shrift kichrayishi mumkin.", RECOMMENDED_LINE_LENGTH)}
                </span>
              ) : (
                tr("Har qator — alohida qatorda. Bandlar orasida bitta bo'sh qator qoldiring.")
              )
            }
          >
            <TextBlock
              value={text}
              onChange={setText}
              placeholder={"Quyoshcha, quyoshcha,\nNuring sochib kel...\n\nIkkinchi band..."}
              maxLength={6000}
              minRows={8}
              error={show("text")}
              ariaLabel="Matn"
            />
          </FormSection>
        ) : (
          <PoemReading title={title} author={author.trim() || null} stanzas={stanzas} />
        )}
      </section>

      <FormSection title={tr("Kimga")} footer={tr(publishFooter(status))}>
        <GroupPickerRow groups={groups} value={groupId} onChange={setGroupId} allowWholeBranch={!isTeacher} error={show("group")} />
        <AgeRangeRow
          from={ageFrom}
          to={ageTo}
          onChange={(f, t) => {
            setAgeFrom(f);
            setAgeTo(t);
          }}
        />
        <PublishRow status={status} onChange={setStatus} />
      </FormSection>

      <FormError message={save.error ? (save.error instanceof ApiError ? save.error.message : "Kutilmagan xatolik yuz berdi") : null} />
    </IosSheet>
  );
}
