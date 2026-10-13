"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { FieldRow, IosSwitch, TextInput } from "@/components/ios/form";
import { IOS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  medicationName: z.string().min(2, "Nomi kamida 2 belgi"),
  dose: z.string().min(1, "Doza talab qilinadi"),
  givenAt: z.string().min(1, "Sana/vaqt talab qilinadi"),
  parentAuthorized: z.boolean(),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function nowForInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

const DATE_INPUT = "min-h-[44px] cursor-pointer text-right [&::-webkit-date-and-time-value]:text-right";
const TEXTAREA = "block w-full resize-none bg-transparent text-[15px] leading-snug text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]";

export function AddMedicationModal({
  open,
  onClose,
  slug,
  childId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  childId: string;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const formId = useId();
  const ids = { name: useId(), dose: useId(), givenAt: useId(), parent: useId(), note: useId() };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { medicationName: "", dose: "", givenAt: nowForInput(), parentAuthorized: false, note: "" },
  });

  const parentAuthorized = watch("parentAuthorized");
  // Majburiy maydonlar to'lmaguncha asosiy tugma xira
  const incomplete = (watch("medicationName") ?? "").length < 2 || !watch("dose") || !watch("givenAt");

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(`/app/children/${childId}/medications`, {
        medicationName: values.medicationName,
        dose: values.dose,
        givenAt: new Date(values.givenAt).toISOString(),
        parentAuthorized: values.parentAuthorized,
        note: values.note || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["medications", slug, childId] });
      reset();
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const busy = isSubmitting || mutation.isPending;

  return (
    <IosSheet
      open={open}
      onClose={() => !busy && onClose()}
      title={tr("Yangi dori-darmon yozuvi")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={busy} dim={incomplete}>
          {tr("Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit((values) => mutation.mutate(values))}>
        <SheetSection>
          <FieldRow label={tr("Dori nomi")} htmlFor={ids.name} error={errors.medicationName?.message}>
            <TextInput id={ids.name} placeholder={tr("Paratsetamol")} autoComplete="off" className="min-h-[44px] text-right" {...register("medicationName")} />
          </FieldRow>
          <FieldRow label={tr("Doza")} htmlFor={ids.dose} error={errors.dose?.message}>
            <TextInput id={ids.dose} placeholder="5 ml" autoComplete="off" className="min-h-[44px] text-right" {...register("dose")} />
          </FieldRow>
          <FieldRow label={tr("Berilgan sana/vaqt")} htmlFor={ids.givenAt} error={errors.givenAt?.message}>
            <TextInput id={ids.givenAt} type="datetime-local" className={DATE_INPUT} {...register("givenAt")} />
          </FieldRow>
        </SheetSection>

        <section>
          <SheetSection>
            <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4">
              <label htmlFor={ids.parent} className="min-w-0 flex-1 py-3 text-[15px] leading-snug text-[var(--color-text)]">
                {tr("Ota-ona rasman ruxsat bergan")}
              </label>
              <IosSwitch
                id={ids.parent}
                checked={!!parentAuthorized}
                onChange={(checked) => setValue("parentAuthorized", checked, { shouldDirty: true })}
                label={tr("Ota-ona rasman ruxsat bergan")}
              />
              <span className={ROW_SEPARATOR} aria-hidden="true" />
            </div>
          </SheetSection>
          {!parentAuthorized && (
            <div className="mt-2 flex items-start gap-2.5 rounded-[14px] px-4 py-3 text-[13px] leading-snug text-[var(--color-text)]" style={{ backgroundColor: `${IOS.orange}1f` }}>
              <TriangleAlert className="mt-px h-4 w-4 shrink-0" style={{ color: IOS.orange }} strokeWidth={2} aria-hidden="true" />
              <span>{tr("Diqqat: ota-ona ruxsati belgilanmagan. Baribir saqlashingiz mumkin, lekin bu xavfsizlik nuqtai nazaridan muhim maydon.")}</span>
            </div>
          )}
        </section>

        <SheetSection>
          <FieldRow label={tr("Izoh")} htmlFor={ids.note} stacked>
            <textarea id={ids.note} rows={2} placeholder={tr("Ixtiyoriy")} className={TEXTAREA} {...register("note")} />
          </FieldRow>
        </SheetSection>

        {serverError && (
          <p role="alert" className="px-4 text-[13px] text-[#ff3b30]">
            {tr(serverError)}
          </p>
        )}
      </form>
    </IosSheet>
  );
}
