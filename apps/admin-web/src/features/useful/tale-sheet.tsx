"use client";

import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Group, Tale, UsefulStatus } from "@/lib/types";
import { IosSheet, SheetPrimaryButton } from "@/components/ios/sheet";
import { FormSection } from "@/components/ios/form";
import { CheckIcon } from "@/components/ios/icons";
import { ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { TaleCover } from "@/app/(parent)/ota-ona/[slug]/(cabinet)/foydali/ui";
import { useTr } from "@/i18n/tr";
import { splitIntoBlocks } from "./split-blocks";
import {
  AgeRangeRow,
  FIELD,
  FormError,
  GroupPickerRow,
  InputRow,
  PublishRow,
  ReadingCard,
  TextBlock,
  WritePreviewToggle,
  publishFooter,
} from "./useful-parts";

type Cover = "tun" | "sholgom";
const COVERS: { value: Cover; label: string }[] = [
  { value: "tun", label: "Tungi osmon" },
  { value: "sholgom", label: "Sholg'om" },
];
const MAX_QUESTIONS = 8;

/** Ertak — ota-onalar ko'radigan ko'rinishda: muqova, matn, saboq, savollar */
export function TaleReading({
  title,
  origin,
  minutes,
  cover,
  paragraphs,
  moral,
  questions,
}: {
  title: string;
  origin: string;
  minutes: number | null;
  cover: string;
  paragraphs: string[];
  moral: string;
  questions: string[];
}) {
  const tr = useTr();
  return (
    <ReadingCard>
      <div className="-mx-5 -mt-5 overflow-hidden rounded-t-[18px]">
        <TaleCover kind={(cover as Cover) ?? "tun"} className="block h-36 w-full" />
      </div>
      <div>
        <p className="text-[20px] font-bold leading-tight text-[var(--color-text)]">{title ? tr(title) : tr("Sarlavha")}</p>
        <p className="mt-1 text-[14px] text-[#8e8e93]">
          {[origin && tr(origin), minutes ? tr("{0} daqiqa", minutes) : null].filter(Boolean).join(" · ")}
        </p>
      </div>
      {paragraphs.length === 0 ? (
        <p className="text-[14px] text-[#8e8e93]">{tr("Matn kiritilgach shu yerda ko'rinadi")}</p>
      ) : (
        paragraphs.map((p, i) => (
          <p key={i} className="text-[16.5px] leading-[1.65] text-[var(--color-text)]">
            {tr(p)}
          </p>
        ))
      )}
      {moral.trim() && (
        <div className="rounded-[14px] bg-[#30b0c7]/[0.1] px-4 py-3">
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#30b0c7]">{tr("Saboq")}</p>
          <p className="mt-1 text-[15.5px] leading-relaxed text-[var(--color-text)]">{tr(moral)}</p>
        </div>
      )}
      {questions.length > 0 && (
        <div>
          <p className="text-[12.5px] font-semibold uppercase tracking-wide text-[#8e8e93]">{tr("Bola bilan suhbat")}</p>
          <ol className="mt-1.5 space-y-1.5">
            {questions.map((q, i) => (
              <li key={i} className="flex gap-2.5 text-[15.5px] leading-snug text-[var(--color-text)]">
                <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[12px] font-semibold tabular-nums text-[#8e8e93]">
                  {i + 1}
                </span>
                <span className="min-w-0">{tr(q)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </ReadingCard>
  );
}

/** Yangi ertak / tahrirlash — iOS varag'i */
export function TaleSheet({
  open,
  onClose,
  slug,
  groups,
  isTeacher,
  tale,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  groups: Group[];
  isTeacher: boolean;
  tale: Tale | null;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const isEdit = !!tale;

  const [title, setTitle] = useState("");
  const [origin, setOrigin] = useState("");
  const [text, setText] = useState("");
  const [moral, setMoral] = useState("");
  const [questions, setQuestions] = useState<string[]>([]);
  const [minutes, setMinutes] = useState("");
  const [cover, setCover] = useState<Cover>("tun");
  const [groupId, setGroupId] = useState("");
  const [ageFrom, setAgeFrom] = useState(3);
  const [ageTo, setAgeTo] = useState(7);
  const [status, setStatus] = useState<UsefulStatus>("PUBLISHED");
  const [mode, setMode] = useState<"write" | "preview">("write");
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(tale?.title ?? "");
    setOrigin(tale?.origin ?? "");
    setText(tale ? tale.paragraphs.join("\n\n") : "");
    setMoral(tale?.moral ?? "");
    setQuestions(tale?.questions ?? []);
    setMinutes(tale?.minutes ? String(tale.minutes) : "");
    setCover(tale?.cover === "sholgom" ? "sholgom" : "tun");
    setGroupId(tale?.groupId ?? "");
    setAgeFrom(tale?.ageFrom ?? 3);
    setAgeTo(tale?.ageTo ?? 7);
    setStatus(tale?.status ?? "PUBLISHED");
    setMode("write");
    setTried(false);
  }, [open, tale]);

  // Tarbiyachining bitta guruhi bo'lsa — o'zi tanlanadi
  const onlyGroupId = isTeacher && groups.length === 1 ? groups[0].id : "";
  useEffect(() => {
    if (open && onlyGroupId) setGroupId((current) => current || onlyGroupId);
  }, [open, onlyGroupId]);

  const paragraphs = useMemo(() => splitIntoBlocks(text).map((b) => b.join(" ")), [text]);
  const cleanQuestions = questions.map((q) => q.trim()).filter(Boolean);
  const badQuestion = cleanQuestions.some((q) => q.length < 3 || q.length > 150);

  const errors = {
    title: !title.trim() ? "Sarlavhani kiriting" : undefined,
    origin: !origin.trim() ? "Kelib chiqishini kiriting" : undefined,
    text: !text.trim() ? "Matnni kiriting" : undefined,
    moral: moral.trim().length < 3 ? "Kamida 3 belgi" : undefined,
    questions: badQuestion ? "Har bir savol 3–150 belgidan iborat bo'lishi kerak" : undefined,
    minutes: minutes && (!/^\d+$/.test(minutes) || Number(minutes) < 1) ? "Butun son kiriting" : undefined,
    group: isTeacher && !groupId ? "Guruhni tanlang" : undefined,
  };
  const valid = Object.values(errors).every((e) => !e);
  const show = (key: keyof typeof errors) => (tried ? errors[key] : undefined);

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(),
        origin: origin.trim(),
        text,
        moral: moral.trim(),
        questions: cleanQuestions,
        minutes: minutes ? Number(minutes) : null,
        cover,
        groupId: groupId || null,
        ageFrom,
        ageTo,
        status,
      };
      return isEdit ? api.patch<Tale>(`/app/useful/tales/${tale!.id}`, payload) : api.post<Tale>("/app/useful/tales", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["useful-tales", slug] });
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
      if (errors.text) setMode("write");
      return;
    }
    if (!save.isPending) save.mutate();
  };

  const setQuestion = (index: number, value: string) => setQuestions((prev) => prev.map((q, i) => (i === index ? value : q)));

  return (
    <IosSheet
      open={open}
      onClose={() => !save.isPending && onClose()}
      title={tr(isEdit ? "Ertakni tahrirlash" : "Yangi ertak")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={save.isPending} dim={!valid}>
          {tr(isEdit ? "Saqlash" : "Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <FormSection>
        <InputRow label="Sarlavha" value={title} onChange={setTitle} placeholder="Sholg'om" maxLength={80} error={show("title")} />
        <InputRow label="Kelib chiqishi" value={origin} onChange={setOrigin} placeholder="O'zbek xalq ertagi" maxLength={120} error={show("origin")} />
      </FormSection>

      <section className="space-y-2">
        <WritePreviewToggle value={mode} onChange={setMode} />
        {mode === "write" ? (
          <FormSection footer={tr("Xatboshilar orasida bitta bo'sh qator qoldiring.")}>
            <TextBlock
              value={text}
              onChange={setText}
              placeholder={"Bir bor ekan, bir yo'q ekan...\n\nKeyingi xatboshi..."}
              maxLength={8000}
              minRows={8}
              error={show("text")}
              ariaLabel="Matn"
            />
          </FormSection>
        ) : (
          <TaleReading
            title={title}
            origin={origin}
            minutes={minutes ? Number(minutes) || null : null}
            cover={cover}
            paragraphs={paragraphs}
            moral={moral}
            questions={cleanQuestions}
          />
        )}
      </section>

      <FormSection title={tr("Saboq")} footer={tr("Ertakdan bola nimani o'rganadi — bir-ikki gap.")}>
        <TextBlock value={moral} onChange={setMoral} placeholder="Birlikda kuch bor." maxLength={300} minRows={2} error={show("moral")} ariaLabel="Saboq" />
      </FormSection>

      <FormSection
        title={tr("Savollar · ixtiyoriy")}
        footer={show("questions") ? <span className="text-[#ff3b30]">{tr(errors.questions!)}</span> : tr("Ota-ona ertakdan keyin bolaga beradi. Ko'pi bilan {0} ta.", MAX_QUESTIONS)}
      >
        {questions.map((q, i) => (
          <div key={i} className="group/row relative flex min-h-[50px] items-center gap-2 pl-4 pr-2">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#767680]/[0.12] text-[12.5px] font-semibold tabular-nums text-[#8e8e93]">{i + 1}</span>
            <input
              value={q}
              onChange={(e) => setQuestion(i, e.target.value)}
              maxLength={150}
              placeholder={tr("Savolni yozing")}
              aria-label={tr("{0}-savol", i + 1)}
              className={clsx(FIELD, "min-w-0 flex-1 py-3")}
            />
            <button
              type="button"
              onClick={() => setQuestions((prev) => prev.filter((_, j) => j !== i))}
              aria-label={tr("Savolni olib tashlash")}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#8e8e93] transition-colors active:bg-[#767680]/[0.12] active:text-[#ff3b30]"
            >
              <X className="h-[18px] w-[18px]" strokeWidth={2.2} />
            </button>
            <span className={ROW_SEPARATOR} aria-hidden="true" />
          </div>
        ))}
        {questions.length < MAX_QUESTIONS && (
          <div className="group/row relative">
            <button
              type="button"
              onClick={() => setQuestions((prev) => [...prev, ""])}
              className={clsx("flex min-h-[50px] w-full items-center gap-2 px-4 text-left text-[16px] font-medium text-[var(--color-primary)]", ROW_PRESS)}
            >
              <Plus className="h-5 w-5" strokeWidth={2.4} />
              {tr("Savol qo'shish")}
            </button>
            <span className={ROW_SEPARATOR} aria-hidden="true" />
          </div>
        )}
      </FormSection>

      <FormSection title={tr("Muqova")}>
        <div role="radiogroup" aria-label={tr("Muqova")} className="grid grid-cols-2 gap-3 p-3">
          {COVERS.map((c) => {
            const active = cover === c.value;
            return (
              <button
                key={c.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setCover(c.value)}
                className={clsx(
                  "relative overflow-hidden rounded-[14px] text-left transition-transform active:scale-[0.97]",
                  active ? "ring-[3px] ring-[var(--color-primary)]" : "ring-1 ring-black/[0.08]",
                )}
              >
                <TaleCover kind={c.value} className="block h-20 w-full" />
                <span className="flex items-center justify-between gap-2 bg-white px-3 py-2 text-[14px] font-medium text-[var(--color-text)]">
                  <span className="truncate">{tr(c.label)}</span>
                  {active && <CheckIcon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" strokeWidth={2.8} />}
                </span>
              </button>
            );
          })}
        </div>
      </FormSection>

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
        <InputRow label="O'qish vaqti" value={minutes} onChange={(v) => setMinutes(v.replace(/\D/g, "").slice(0, 3))} placeholder="Avto · daqiqa" inputMode="numeric" error={show("minutes")} />
        <PublishRow status={status} onChange={setStatus} />
      </FormSection>

      <FormError message={save.error ? (save.error instanceof ApiError ? save.error.message : "Kutilmagan xatolik yuz berdi") : null} />
    </IosSheet>
  );
}
