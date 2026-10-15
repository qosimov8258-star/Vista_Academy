"use client";

import { Controller, useForm, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import clsx from "clsx";
import { Check, Search } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Guardian } from "@/lib/types";
import { formatPhone } from "@/lib/format";
import { FieldRow, IosSwitch, Segmented, TextInput } from "@/components/ios/form";
import { IosAvatar } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

const schema = z.object({
  fullName: z.string().optional(),
  phone: z.string().optional(),
  relation: z.enum(["FATHER", "MOTHER", "GRANDPARENT", "OTHER"]),
  isPrimary: z.boolean(),
  canPickup: z.boolean(),
  canViewFinance: z.boolean(),
  canReceiveNotifications: z.boolean(),
});

type FormValues = z.infer<typeof schema>;
type Relation = FormValues["relation"];

/** Qarindoshlik va huquqlar — qo'shish va tahrirlash varaqlarida bir xil */
type LinkFields = Pick<FormValues, "relation" | "isPrimary" | "canPickup" | "canViewFinance" | "canReceiveNotifications">;

const RELATIONS: { value: Relation; label: string }[] = [
  { value: "FATHER", label: "Ota" },
  { value: "MOTHER", label: "Ona" },
  { value: "GRANDPARENT", label: "Bobo/Buvi" },
  { value: "OTHER", label: "Boshqa" },
];

const PERMISSIONS: { name: Exclude<keyof LinkFields, "relation">; label: string; hint: string }[] = [
  { name: "isPrimary", label: "Asosiy vasiy", hint: "Ro'yxatlarda va xabarlarda birinchi bo'lib ko'rsatiladi" },
  { name: "canPickup", label: "Bolani olib ketishi mumkin", hint: "Bolani bog'chadan olib ketishga ruxsat berilgan" },
  { name: "canViewFinance", label: "Moliyani ko'ra oladi", hint: "Kabinetda to'lov eslatmalari va cheklarni ko'radi" },
  { name: "canReceiveNotifications", label: "Bildirishnoma oladi", hint: "Davomat, kunlik hisobot va to'lovlar haqida xabar oladi" },
];

/** Qarindoshlik turi — 4 variantli iOS segmenti (native select emas) */
export function GuardianRelationSection<T extends LinkFields>({ control }: { control: Control<T> }) {
  const tr = useTr();
  const ctl = control as unknown as Control<LinkFields>;
  return (
    <SheetSection title={tr("Qarindoshlik turi")}>
      <div className="p-3">
        <Controller
          control={ctl}
          name="relation"
          render={({ field }) => (
            <Segmented<Relation>
              value={field.value}
              onChange={field.onChange}
              label={tr("Qarindoshlik turi")}
              options={RELATIONS.map((r) => ({ value: r.value, label: tr(r.label) }))}
            />
          )}
        />
      </div>
    </SheetSection>
  );
}

/** Huquqlar — har biri iOS switch qatori, ostida 13px kulrang izoh */
export function GuardianPermissionsSection<T extends LinkFields>({ control }: { control: Control<T> }) {
  const tr = useTr();
  const ctl = control as unknown as Control<LinkFields>;
  return (
    <SheetSection title={tr("Huquqlar")}>
      {PERMISSIONS.map((p) => (
        <Controller
          key={p.name}
          control={ctl}
          name={p.name}
          render={({ field }) => (
            <div className="group/row relative flex min-h-[60px] items-center gap-3 px-4 py-2.5">
              <button type="button" onClick={() => field.onChange(!field.value)} className="min-w-0 flex-1 text-left">
                <span className="block text-[15px] text-[var(--color-text)]">{tr(p.label)}</span>
                <span className="mt-0.5 block text-[13px] leading-snug text-[#8e8e93]">{tr(p.hint)}</span>
              </button>
              <IosSwitch checked={!!field.value} onChange={field.onChange} label={tr(p.label)} />
              <span className={ROW_SEPARATOR} aria-hidden="true" />
            </div>
          )}
        />
      ))}
    </SheetSection>
  );
}

/** Mahalliy 9 raqam: "+998 90 123 45 67" yoki "901234567" → "901234567" */
function localDigits(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 9 && digits.startsWith("998")) digits = digits.slice(3);
  return digits.slice(0, 9);
}

/** "901234567" → "90 123 45 67" */
function formatLocal(digits: string): string {
  return [digits.slice(0, 2), digits.slice(2, 5), digits.slice(5, 7), digits.slice(7, 9)].filter(Boolean).join(" ");
}

export function AddGuardianModal({
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
  const formId = useId();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [selectedGuardian, setSelectedGuardian] = useState<Guardian | null>(null);

  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: "",
      phone: "",
      relation: "OTHER",
      isPrimary: false,
      canPickup: true,
      canViewFinance: true,
      canReceiveNotifications: true,
    },
  });

  const searchQuery = useQuery({
    queryKey: ["guardian-search", search],
    queryFn: () => api.get<Guardian[]>(`/app/guardians?search=${encodeURIComponent(search)}`),
    enabled: search.length > 0,
  });

  const mutation = useMutation({
    mutationFn: (values: FormValues) =>
      api.post(`/app/children/${childId}/guardians`, {
        guardianId: mode === "existing" ? selectedGuardian?.id : undefined,
        fullName: mode === "new" ? values.fullName : undefined,
        phone: mode === "new" ? values.phone : undefined,
        relation: values.relation,
        isPrimary: values.isPrimary,
        canPickup: values.canPickup,
        canViewFinance: values.canViewFinance,
        canReceiveNotifications: values.canReceiveNotifications,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child-guardians", slug, childId] });
      // Ro'yxatdagi ustun asosiy vasiyni ko'rsatadi — shu ham yangilansin.
      queryClient.invalidateQueries({ queryKey: ["children", slug] });
      reset();
      setSelectedGuardian(null);
      setSearch("");
      setSearchInput("");
      onClose();
    },
    onError: (err) => {
      setServerError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
    },
  });

  const onSubmit = (values: FormValues) => {
    setServerError(null);
    if (mode === "existing" && !selectedGuardian) {
      setServerError(tr("Ota-onani ro'yxatdan tanlang"));
      return;
    }
    if (mode === "new" && (!values.fullName || values.fullName.trim().length < 2)) {
      setServerError(tr("To'liq ism kamida 2 belgi bo'lishi kerak"));
      return;
    }
    if (mode === "new" && (!values.phone || values.phone.trim().length < 3)) {
      setServerError("Telefon raqami talab qilinadi");
      return;
    }
    mutation.mutate(values);
  };

  const pending = isSubmitting || mutation.isPending;
  const runSearch = () => setSearch(searchInput.trim());
  const results = searchQuery.data ?? [];

  return (
    <IosSheet
      open={open}
      onClose={() => !pending && onClose()}
      title={tr("Ota-ona qo'shish")}
      footer={
        <SheetPrimaryButton type="submit" form={formId} loading={pending} dim={mode === "existing" && !selectedGuardian}>
          {tr("Qo'shish")}
        </SheetPrimaryButton>
      }
    >
      <form id={formId} className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
        <Segmented<"existing" | "new">
          value={mode}
          onChange={(next) => {
            setMode(next);
            setServerError(null);
          }}
          label={tr("Ota-ona qo'shish")}
          options={[
            { value: "existing", label: tr("Mavjudidan tanlash") },
            { value: "new", label: tr("Yangi ota-ona") },
          ]}
        />

        {serverError && (
          <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.1] px-4 py-2.5 text-[13px] leading-snug text-[#ff3b30]">
            {tr(serverError)}
          </p>
        )}

        {mode === "existing" ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <label className="relative flex h-11 min-w-0 flex-1 items-center">
                <Search className="pointer-events-none absolute left-3.5 h-[17px] w-[17px] text-[#8e8e93]" strokeWidth={2.2} />
                <input
                  type="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    // Enter — formani yubormaydi, qidiradi
                    if (e.key === "Enter") {
                      e.preventDefault();
                      runSearch();
                    }
                  }}
                  placeholder={tr("Ism yoki telefon bo'yicha qidirish")}
                  enterKeyHint="search"
                  className="h-11 w-full min-w-0 rounded-full bg-[#767680]/[0.12] pl-10 pr-4 text-[15px] text-[var(--color-text)] outline-none transition-colors placeholder:text-[#8e8e93] focus:bg-[#767680]/[0.16] [&::-webkit-search-cancel-button]:hidden"
                />
              </label>
              <button
                type="button"
                onClick={runSearch}
                className="h-11 shrink-0 rounded-full bg-[var(--color-primary)]/12 px-4 text-[15px] font-semibold text-[var(--color-primary)] transition-transform active:scale-[0.96]"
              >
                {tr("Qidirish")}
              </button>
            </div>

            {searchQuery.isFetching && (
              <p className="flex items-center gap-2 px-4 text-[13px] text-[#8e8e93]">
                <Spinner className="h-4 w-4" />
                {tr("Qidirilmoqda...")}
              </p>
            )}
            {!searchQuery.isFetching && searchQuery.data && results.length === 0 && (
              <p className="px-4 text-[13px] text-[#8e8e93]">{tr("Hech kim topilmadi")}</p>
            )}

            {results.length > 0 && (
              <SheetSection>
                <div className="max-h-[264px] overflow-y-auto overscroll-contain">
                  {results.map((g) => {
                    const checked = selectedGuardian?.id === g.id;
                    return (
                      <div key={g.id} className="group/row relative">
                        <button
                          type="button"
                          onClick={() => setSelectedGuardian(g)}
                          aria-pressed={checked}
                          className={clsx("flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS)}
                        >
                          <IosAvatar name={g.fullName} size={40} />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium text-[var(--color-text)]">{tr(g.fullName)}</span>
                            <span className="block truncate text-[13px] tabular-nums text-[#8e8e93]">{formatPhone(g.phone)}</span>
                          </span>
                          <span
                            aria-hidden="true"
                            className={clsx(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                              checked ? "bg-[var(--color-primary)] text-white" : "ring-[1.5px] ring-inset ring-[#c7c7cc]",
                            )}
                          >
                            {checked && <Check className="h-4 w-4" strokeWidth={3} />}
                          </span>
                        </button>
                        <span className={ROW_SEPARATOR} style={{ left: 68 }} aria-hidden="true" />
                      </div>
                    );
                  })}
                </div>
              </SheetSection>
            )}

            {selectedGuardian && (
              <p className="flex items-center gap-2 rounded-[14px] bg-[#34c759]/[0.1] px-4 py-2.5 text-[14px] text-[var(--color-text)]">
                <Check className="h-4 w-4 shrink-0 text-[#34c759]" strokeWidth={2.6} />
                <span className="min-w-0 truncate">
                  {tr("Tanlandi:")} <strong className="font-semibold">{tr(selectedGuardian.fullName)}</strong>{" "}
                  <span className="tabular-nums text-[#8e8e93]">({formatPhone(selectedGuardian.phone)})</span>
                </span>
              </p>
            )}
          </div>
        ) : (
          <SheetSection footer={tr("Xuddi shu raqam bilan yana bola qo'shilsa, ikkalasi bir ota-onaga bog'lanadi")}>
            <FieldRow label={tr("To'liq ism")} htmlFor={`${formId}-name`}>
              <TextInput id={`${formId}-name`} placeholder={tr("Karimova Aziza")} autoComplete="off" className="text-right" {...register("fullName")} />
            </FieldRow>
            <Controller
              control={control}
              name="phone"
              render={({ field }) => {
                const digits = localDigits(field.value ?? "");
                return (
                  <label htmlFor={`${formId}-phone`} className="group/row relative flex min-h-[60px] items-center gap-3 px-4">
                    <span className="shrink-0 text-[15px] text-[var(--color-text)]">{tr("Telefon")}</span>
                    <span className="flex min-w-0 flex-1 items-baseline justify-end gap-1.5">
                      <span className="shrink-0 text-[20px] font-semibold tabular-nums text-[#8e8e93]">+998</span>
                      <input
                        id={`${formId}-phone`}
                        name={field.name}
                        ref={field.ref}
                        type="tel"
                        inputMode="tel"
                        autoComplete="off"
                        value={formatLocal(digits)}
                        onChange={(e) => {
                          const next = localDigits(e.target.value);
                          field.onChange(next ? `+998${next}` : "");
                        }}
                        onBlur={field.onBlur}
                        placeholder="90 123 45 67"
                        className="min-w-0 max-w-[150px] flex-1 bg-transparent py-3 text-[20px] font-semibold tabular-nums text-[var(--color-text)] outline-none placeholder:font-normal placeholder:text-[#c4c4c6]"
                      />
                    </span>
                    <span className={ROW_SEPARATOR} aria-hidden="true" />
                  </label>
                );
              }}
            />
          </SheetSection>
        )}

        <GuardianRelationSection control={control} />
        <GuardianPermissionsSection control={control} />
      </form>
    </IosSheet>
  );
}
