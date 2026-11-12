"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import clsx from "clsx";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Baby, IdCard, Send, School, UsersRound } from "lucide-react";
import { api, ApiError, getPaginated } from "@/lib/api";
import type { BroadcastAudience, BroadcastPreview, BroadcastScope, BroadcastTarget, Child, Employee, Group } from "@/lib/types";
import { formatChildId } from "@/lib/format";
import { CheckIcon } from "@/components/ios/icons";
import { FieldRow, IosSwitch, Segmented, TextArea, TextInput } from "@/components/ios/form";
import { SearchPill } from "@/components/ios/filters";
import { IosSheet, SheetPrimaryButton, SheetSecondaryButton, SheetSection } from "@/components/ios/sheet";
import { Spinner } from "@/components/ios/spinner";
import { GROUP_BLOCK, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { IosIcon } from "@/features/director/ios-icon";
import { useTr } from "@/i18n/tr";

export const TITLE_MAX = 120;
export const BODY_MAX = 2000;
/** Tarbiyachi va oshpaz — «Xabarlar» sahifasi shu rollarda (API bilan bir xil) */
const INBOX_ROLES = new Set(["TEACHER", "CHEF"]);

type Step = "edit" | "confirm" | "done";

/**
 * Yangi xabar: kimga (ota-onalar / xodimlar → butun filial, guruhlar yoki
 * tanlab), sarlavha, matn va «Majburiy o'qish». Pastda jonli hisob — necha
 * kishiga borishi; «Yuborish» avval tasdiqlash bosqichini ochadi (qaytarib
 * bo'lmaydi), keyin natija.
 */
export function BroadcastCompose({ open, onClose, slug }: { open: boolean; onClose: () => void; slug: string }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [audience, setAudience] = useState<BroadcastAudience>("GUARDIANS");
  const [scope, setScope] = useState<BroadcastScope>("BRANCH");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [children, setChildren] = useState<Map<string, string>>(new Map());
  const [employees, setEmployees] = useState<Map<string, string>>(new Map());
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mandatory, setMandatory] = useState(false);
  const [step, setStep] = useState<Step>("edit");
  const [picker, setPicker] = useState<"groups" | "children" | "employees" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [result, setResult] = useState<{ recipients: number; noCabinet: number } | null>(null);

  // Yopilganda (va yuborilgach) qoralama tozalanadi — keyingi ochilish toza
  const reset = () => {
    setAudience("GUARDIANS");
    setScope("BRANCH");
    setGroupIds([]);
    setChildren(new Map());
    setEmployees(new Map());
    setTitle("");
    setBody("");
    setMandatory(false);
    setStep("edit");
    setError(null);
    setShowErrors(false);
    setResult(null);
  };
  useEffect(() => {
    if (open) return;
    const t = setTimeout(reset, 450);
    return () => clearTimeout(t);
  }, [open]);

  const groupsQuery = useQuery({ queryKey: ["groups", slug], queryFn: () => api.get<Group[]>("/app/groups"), enabled: open });
  // Bolasi ko'p guruh tepada — bo'sh guruhlar ro'yxat oxirida
  const groups = useMemo(
    () =>
      (groupsQuery.data ?? [])
        .filter((g) => g.status === "ACTIVE")
        .sort((x, y) => (y._count?.children ?? 0) - (x._count?.children ?? 0) || x.name.localeCompare(y.name)),
    [groupsQuery.data],
  );

  const target: BroadcastTarget = {
    audience,
    scope,
    ...(scope === "GROUPS" ? { groupIds } : {}),
    ...(scope === "PICKED" && audience === "GUARDIANS" ? { childIds: [...children.keys()] } : {}),
    ...(scope === "PICKED" && audience === "EMPLOYEES" ? { employeeIds: [...employees.keys()] } : {}),
  };
  const targetReady =
    scope === "BRANCH" ||
    (scope === "GROUPS" && groupIds.length > 0) ||
    (scope === "PICKED" && (audience === "GUARDIANS" ? children.size > 0 : employees.size > 0));

  // Jonli hisob: kimga va necha kishiga boradi
  const previewQuery = useQuery({
    queryKey: ["broadcast-preview", slug, target],
    queryFn: () => api.post<BroadcastPreview>("/app/broadcasts/preview", target),
    enabled: open && targetReady,
    placeholderData: (prev) => prev,
    staleTime: 15_000,
  });
  const preview = targetReady ? previewQuery.data : undefined;

  const send = useMutation({
    mutationFn: () => api.post<{ id: string; recipients: number; noCabinet: number }>("/app/broadcasts", { ...target, title: title.trim(), body: body.trim(), isMandatory: mandatory }),
    onSuccess: (res) => {
      setResult(res);
      setStep("done");
      queryClient.invalidateQueries({ queryKey: ["broadcasts", slug] });
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi"));
      setStep("edit");
    },
  });

  const titleError = showErrors && !title.trim() ? tr("Sarlavhani yozing") : undefined;
  const bodyError = showErrors && !body.trim() ? tr("Xabar matnini yozing") : undefined;
  const nobody = preview !== undefined && preview.recipients === 0;
  const valid = Boolean(title.trim() && body.trim() && targetReady && preview && preview.recipients > 0);

  const goConfirm = () => {
    setShowErrors(true);
    setError(null);
    if (!targetReady) {
      setError(scope === "GROUPS" ? tr("Kamida bitta guruh tanlang") : audience === "GUARDIANS" ? tr("Kamida bitta bolani tanlang") : tr("Kamida bitta xodimni tanlang"));
      return;
    }
    if (valid) setStep("confirm");
  };

  // Rus/ingliz tilida kelishik boshqacha — har bir auditoriyaga alohida matn
  const per = (guardians: string, staff: string, n: number) => tr(audience === "GUARDIANS" ? guardians : staff, n);
  const scopeOptions: { value: BroadcastScope; label: string; icon: typeof School; tint: "blue" | "orange" | "purple" }[] =
    audience === "GUARDIANS"
      ? [
          { value: "BRANCH", label: tr("Butun filial"), icon: School, tint: "blue" },
          { value: "GROUPS", label: tr("Guruhlar bo'yicha"), icon: UsersRound, tint: "orange" },
          { value: "PICKED", label: tr("Bolalarni tanlab"), icon: Baby, tint: "purple" },
        ]
      : [
          { value: "BRANCH", label: tr("Hamma xodim"), icon: School, tint: "blue" },
          { value: "GROUPS", label: tr("Guruh tarbiyachilari"), icon: UsersRound, tint: "orange" },
          { value: "PICKED", label: tr("Xodimlarni tanlab"), icon: IdCard, tint: "purple" },
        ];

  const pickedCount = scope === "GROUPS" ? groupIds.length : audience === "GUARDIANS" ? children.size : employees.size;

  return (
    <>
      <IosSheet
        open={open}
        onClose={() => !send.isPending && onClose()}
        cancelLabel={step === "done" ? "Yopish" : "Bekor qilish"}
        title={step === "confirm" ? tr("Tasdiqlash") : step === "done" ? tr("Yuborildi") : tr("Yangi xabar")}
        footer={
          step === "edit" ? (
            <SheetPrimaryButton onClick={goConfirm} dim={!valid}>
              <Send className="h-[18px] w-[18px]" strokeWidth={2.2} />
              {preview && preview.recipients > 0 ? per("{0} ta ota-onaga yuborish", "{0} ta xodimga yuborish", preview.recipients) : tr("Yuborish")}
            </SheetPrimaryButton>
          ) : step === "confirm" ? (
            <div className="flex gap-2.5">
              <div className="flex-1">
                <SheetSecondaryButton onClick={() => setStep("edit")}>{tr("Orqaga")}</SheetSecondaryButton>
              </div>
              <div className="flex-1">
                <SheetPrimaryButton onClick={() => send.mutate()} loading={send.isPending}>
                  {tr("Yuborish")}
                </SheetPrimaryButton>
              </div>
            </div>
          ) : (
            <SheetPrimaryButton onClick={onClose}>{tr("Tayyor")}</SheetPrimaryButton>
          )
        }
      >
        {step === "edit" && (
          <>
            <Segmented<BroadcastAudience>
              value={audience}
              onChange={(value) => {
                setAudience(value);
                setError(null);
              }}
              label={tr("Kimga")}
              options={[
                { value: "GUARDIANS", label: tr("Ota-onalarga") },
                { value: "EMPLOYEES", label: tr("Xodimlarga") },
              ]}
            />

            <SheetSection
              title={tr("Kimga")}
              footer={audience === "EMPLOYEES" ? tr("Xabar tarbiyachi va oshpazning «Xabarlar» sahifasiga tushadi.") : tr("Xabar ota-ona kabinetiga tushadi, telefoniga bildirishnoma ham boradi.")}
            >
              {scopeOptions.map((option) => (
                <ChoiceRow
                  key={option.value}
                  role="radio"
                  checked={scope === option.value}
                  onClick={() => {
                    setScope(option.value);
                    setError(null);
                    if (option.value === "GROUPS" && groupIds.length === 0) setPicker("groups");
                    if (option.value === "PICKED" && pickedCount === 0) setPicker(audience === "GUARDIANS" ? "children" : "employees");
                  }}
                  leading={<IosIcon icon={option.icon} tint={option.tint} size={30} />}
                  label={option.label}
                />
              ))}
              {scope !== "BRANCH" && (
                <button
                  type="button"
                  onClick={() => setPicker(scope === "GROUPS" ? "groups" : audience === "GUARDIANS" ? "children" : "employees")}
                  className={clsx("group/row relative flex min-h-[48px] w-full items-center gap-3 px-4 text-left", ROW_PRESS)}
                >
                  <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--color-primary)]">
                    {scope === "GROUPS" ? tr("Guruhlarni tanlash") : audience === "GUARDIANS" ? tr("Bolalarni tanlash") : tr("Xodimlarni tanlash")}
                  </span>
                  <span className="shrink-0 text-[15px] tabular-nums text-[#8e8e93]">{pickedCount > 0 ? tr("{0} ta", pickedCount) : tr("Tanlanmagan")}</span>
                  <span className={ROW_SEPARATOR} aria-hidden="true" />
                </button>
              )}
            </SheetSection>

            <RecipientsLine preview={preview} loading={targetReady && previewQuery.isFetching} audience={audience} nobody={nobody} />

            <SheetSection title={tr("Xabar")} footer={`${body.length}/${BODY_MAX}`}>
              <FieldRow label={tr("Sarlavha")} htmlFor="bc-title" error={titleError}>
                <TextInput
                  id="bc-title"
                  value={title}
                  maxLength={TITLE_MAX}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={tr("Masalan: Ertaga dam olish kuni")}
                  autoComplete="off"
                />
              </FieldRow>
              <FieldRow label={tr("Matn")} htmlFor="bc-body" error={bodyError} stacked>
                <TextArea
                  id="bc-body"
                  rows={5}
                  value={body}
                  maxLength={BODY_MAX}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={audience === "GUARDIANS" ? tr("Hurmatli ota-onalar, …") : tr("Hurmatli hamkasblar, …")}
                />
              </FieldRow>
            </SheetSection>

            <SheetSection footer={tr("Yoqilsa, xabar ochib o'qilmaguncha kabinetda yopilmaydigan oyna chiqadi. Muhim e'lonlar uchun.")}>
              <div className="flex min-h-[52px] items-center gap-3 px-4">
                <IosIcon icon={BadgeCheck} tint="red" size={30} />
                <label htmlFor="bc-mandatory" className="min-w-0 flex-1 text-[15px] text-[var(--color-text)]">
                  {tr("Majburiy o'qish")}
                </label>
                <IosSwitch id="bc-mandatory" checked={mandatory} onChange={setMandatory} label={tr("Majburiy o'qish")} />
              </div>
            </SheetSection>

            {(title.trim() || body.trim()) && (
              <section>
                <h3 className="px-4 pb-1.5 text-[13px] uppercase tracking-wide text-[#8e8e93]">{tr("Ko'rinishi")}</h3>
                <MessagePreview title={title} body={body} mandatory={mandatory} />
              </section>
            )}

            {error && (
              <p role="alert" className="rounded-[14px] bg-[#ff3b30]/[0.08] px-4 py-3 text-[13.5px] leading-snug text-[#ff3b30]">
                {error}
              </p>
            )}
          </>
        )}

        {step === "confirm" && preview && (
          <>
            <div className="flex flex-col items-center gap-2 pt-2 text-center">
              <IosIcon icon={Send} tint="blue" size={56} />
              <p className="text-[20px] font-bold leading-tight text-[var(--color-text)]">{per("{0} ta ota-onaga yuborilsinmi?", "{0} ta xodimga yuborilsinmi?", preview.recipients)}</p>
              <p className="text-[13.5px] text-[#8e8e93]">{tr(preview.scopeLabel)}</p>
            </div>
            <MessagePreview title={title} body={body} mandatory={mandatory} />
            {preview.sample.length > 0 && (
              <SheetSection title={tr("Qabul qiluvchilar")}>
                <p className="px-4 py-3 text-[14px] leading-snug text-[var(--color-text)]">
                  {preview.sample.join(", ")}
                  {preview.recipients > preview.sample.length && <span className="text-[#8e8e93]"> {tr("va yana {0} kishi", preview.recipients - preview.sample.length)}</span>}
                </p>
              </SheetSection>
            )}
            <p className="rounded-[14px] bg-[#ff9500]/[0.1] px-4 py-3 text-[13.5px] leading-snug text-[#b25f00]">
              {tr("Yuborilgan xabarni qaytarib yoki tahrirlab bo'lmaydi.")}
            </p>
          </>
        )}

        {step === "done" && result && (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#34c759] text-white">
              <CheckIcon className="h-8 w-8" strokeWidth={3} />
            </span>
            <p className="mt-2 text-[20px] font-bold text-[var(--color-text)]">{per("{0} ta ota-onaga yuborildi", "{0} ta xodimga yuborildi", result.recipients)}</p>
            <p className="max-w-[320px] text-[13.5px] leading-snug text-[#8e8e93]">
              {result.noCabinet > 0
                ? tr("{0} tasining kabineti hali ochilmagan — kirganda ko'radi.", result.noCabinet)
                : tr("Kim o'qiganini «Xabar yuborish» ro'yxatida ko'rasiz.")}
            </p>
          </div>
        )}
      </IosSheet>

      <GroupPicker open={picker === "groups"} onClose={() => setPicker(null)} groups={groups} loading={groupsQuery.isLoading} selected={groupIds} onChange={setGroupIds} />
      <ChildPicker open={picker === "children"} onClose={() => setPicker(null)} selected={children} onChange={setChildren} />
      <EmployeePicker open={picker === "employees"} onClose={() => setPicker(null)} selected={employees} onChange={setEmployees} />
    </>
  );
}

function RecipientsLine({ preview, loading, audience, nobody }: { preview?: BroadcastPreview; loading: boolean; audience: BroadcastAudience; nobody: boolean }) {
  const tr = useTr();
  if (!preview && !loading) return null;
  return (
    <div className={clsx("flex items-start gap-3 rounded-[14px] px-4 py-3", nobody ? "bg-[#ff3b30]/[0.08]" : "bg-[var(--color-primary)]/[0.08]")} aria-live="polite">
      {loading && !preview ? (
        <Spinner className="mt-0.5 h-4 w-4 text-[#8e8e93]" />
      ) : (
        <UsersRound className={clsx("mt-0.5 h-[18px] w-[18px] shrink-0", nobody ? "text-[#ff3b30]" : "text-[var(--color-primary)]")} strokeWidth={2.2} />
      )}
      {preview && (
        <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-[var(--color-text)]">
          {nobody ? (
            <span className="text-[#ff3b30]">{audience === "GUARDIANS" ? tr("Tanlanganlar orasida xabar oladigan ota-ona yo'q") : tr("Tanlanganlar orasida kabineti bor tarbiyachi yoki oshpaz yo'q")}</span>
          ) : (
            <>
              <b className="tabular-nums">{tr(audience === "GUARDIANS" ? "{0} ta ota-onaga boradi" : "{0} ta xodimga boradi", preview.recipients)}</b>
              {preview.noCabinet > 0 && <span className="text-[#8e8e93]"> · {tr("{0} tasining kabineti hali ochilmagan", preview.noCabinet)}</span>}
              {preview.skipped > 0 && <span className="text-[#8e8e93]"> · {tr("{0} kishining «Xabarlar» sahifasi yo'q", preview.skipped)}</span>}
            </>
          )}
        </p>
      )}
    </div>
  );
}

/** Qabul qiluvchida qanday ko'rinishi */
export function MessagePreview({ title, body, mandatory }: { title: string; body: string; mandatory: boolean }) {
  const tr = useTr();
  return (
    <div className={clsx(GROUP_BLOCK, "px-4 py-3.5")}>
      <div className="flex items-start gap-3">
        <IosIcon icon={Send} tint={mandatory ? "red" : "blue"} size={30} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-[15.5px] font-semibold leading-snug text-[var(--color-text)]">
            <span className="min-w-0 break-words">{title.trim() || tr("Sarlavha")}</span>
            {mandatory && <span className="shrink-0 rounded-full bg-[#ff3b30]/[0.12] px-2 py-0.5 text-[11.5px] font-semibold text-[#ff3b30]">{tr("Majburiy")}</span>}
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-[14.5px] leading-snug text-[var(--color-text)]/80">{body.trim() || "…"}</p>
        </div>
      </div>
    </div>
  );
}

/** Ko'p tanlash qatori (✓ o'ngda) yoki bitta tanlash (`role="radio"`) */
function ChoiceRow({
  label,
  subtitle,
  checked,
  onClick,
  leading,
  role = "checkbox",
}: {
  label: ReactNode;
  subtitle?: ReactNode;
  checked: boolean;
  onClick: () => void;
  leading?: ReactNode;
  role?: "checkbox" | "radio";
}) {
  return (
    <div className="group/row relative">
      <button type="button" role={role} aria-checked={checked} onClick={onClick} className={clsx("flex min-h-[48px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS)}>
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-[var(--color-text)]">{label}</span>
          {subtitle && <span className="block truncate text-[12.5px] text-[#8e8e93]">{subtitle}</span>}
        </span>
        {role === "checkbox" ? (
          <span
            aria-hidden="true"
            className={clsx(
              "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors",
              checked ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[#c7c7cc]",
            )}
          >
            {checked && <CheckIcon className="h-3.5 w-3.5" strokeWidth={3.2} />}
          </span>
        ) : (
          checked && <CheckIcon className="h-[18px] w-[18px] shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />
        )}
      </button>
      <span className={ROW_SEPARATOR} style={leading ? { left: 58 } : undefined} aria-hidden="true" />
    </div>
  );
}

function GroupPicker({
  open,
  onClose,
  groups,
  loading,
  selected,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  groups: Group[];
  loading: boolean;
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const tr = useTr();
  const all = groups.length > 0 && groups.every((g) => selected.includes(g.id));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <IosSheet
      open={open}
      onClose={onClose}
      cancelLabel="Yopish"
      title={tr("Guruhlar")}
      action={{ label: all ? "Hech biri" : "Hammasi", onClick: () => onChange(all ? [] : groups.map((g) => g.id)) }}
      footer={<SheetPrimaryButton onClick={onClose}>{selected.length > 0 ? tr("{0} ta guruh tanlandi", selected.length) : tr("Tayyor")}</SheetPrimaryButton>}
    >
      <SheetSection>
        {loading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 text-[#8e8e93]" />
          </div>
        ) : groups.length === 0 ? (
          <p className="px-4 py-4 text-[14px] text-[#8e8e93]">{tr("Guruh yo'q")}</p>
        ) : (
          groups.map((g) => (
            <ChoiceRow
              key={g.id}
              checked={selected.includes(g.id)}
              onClick={() => toggle(g.id)}
              leading={<IosIcon icon={UsersRound} tint="orange" size={30} />}
              label={tr(g.name)}
              subtitle={g._count?.children !== undefined ? tr("{0} ta bola", g._count.children) : undefined}
            />
          ))
        )}
      </SheetSection>
    </IosSheet>
  );
}

function ChildPicker({ open, onClose, selected, onChange }: { open: boolean; onClose: () => void; selected: Map<string, string>; onChange: (next: Map<string, string>) => void }) {
  const tr = useTr();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);
  const query = useQuery({
    queryKey: ["broadcast-children", debounced],
    queryFn: () => getPaginated<Child>(`/app/children?limit=50${debounced ? `&search=${encodeURIComponent(debounced)}` : ""}`),
    enabled: open,
    placeholderData: (prev) => prev,
  });
  const rows = (query.data?.data ?? []).filter((c) => c.status !== "INACTIVE");
  const toggle = (child: Child) => {
    const next = new Map(selected);
    if (next.has(child.id)) next.delete(child.id);
    else next.set(child.id, child.fullName);
    onChange(next);
  };
  const pickedNotShown = [...selected.entries()].filter(([id]) => !rows.some((r) => r.id === id));
  return (
    <IosSheet
      open={open}
      onClose={onClose}
      cancelLabel="Yopish"
      title={tr("Bolalar")}
      action={selected.size > 0 ? { label: "Tozalash", onClick: () => onChange(new Map()) } : undefined}
      footer={<SheetPrimaryButton onClick={onClose}>{selected.size > 0 ? tr("{0} ta bola tanlandi", selected.size) : tr("Tayyor")}</SheetPrimaryButton>}
    >
      <SearchPill value={search} onChange={setSearch} placeholder={tr("Ism yoki id12345")} />
      {pickedNotShown.length > 0 && (
        <SheetSection title={tr("Tanlanganlar")}>
          {pickedNotShown.map(([id, name]) => (
            <ChoiceRow
              key={id}
              checked
              onClick={() => {
                const next = new Map(selected);
                next.delete(id);
                onChange(next);
              }}
              label={name}
            />
          ))}
        </SheetSection>
      )}
      <SheetSection title={debounced ? tr("Qidiruv natijasi") : tr("Bolalar")}>
        {query.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 text-[#8e8e93]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-4 text-[14px] text-[#8e8e93]">{tr("Hech narsa topilmadi")}</p>
        ) : (
          rows.map((c) => (
            <ChoiceRow
              key={c.id}
              checked={selected.has(c.id)}
              onClick={() => toggle(c)}
              label={c.fullName}
              subtitle={[formatChildId(c.publicId), c.group?.name ? tr(c.group.name) : tr("Guruhsiz")].join(" · ")}
            />
          ))
        )}
      </SheetSection>
    </IosSheet>
  );
}

function EmployeePicker({ open, onClose, selected, onChange }: { open: boolean; onClose: () => void; selected: Map<string, string>; onChange: (next: Map<string, string>) => void }) {
  const tr = useTr();
  const [search, setSearch] = useState("");
  const query = useQuery({ queryKey: ["employees", "broadcast"], queryFn: () => api.get<Employee[]>("/app/employees"), enabled: open });
  const all = (query.data ?? []).filter((e) => e.isActive && e.tenantUser?.isActive && INBOX_ROLES.has(e.tenantUser.role));
  const needle = search.trim().toLowerCase();
  const rows = needle ? all.filter((e) => `${e.fullName} ${e.position}`.toLowerCase().includes(needle)) : all;
  const toggle = (e: Employee) => {
    const next = new Map(selected);
    if (next.has(e.id)) next.delete(e.id);
    else next.set(e.id, e.fullName);
    onChange(next);
  };
  const everyone = all.length > 0 && all.every((e) => selected.has(e.id));
  return (
    <IosSheet
      open={open}
      onClose={onClose}
      cancelLabel="Yopish"
      title={tr("Xodimlar")}
      action={all.length > 0 ? { label: everyone ? "Hech biri" : "Hammasi", onClick: () => onChange(everyone ? new Map() : new Map(all.map((e) => [e.id, e.fullName]))) } : undefined}
      footer={<SheetPrimaryButton onClick={onClose}>{selected.size > 0 ? tr("{0} ta xodim tanlandi", selected.size) : tr("Tayyor")}</SheetPrimaryButton>}
    >
      <SearchPill value={search} onChange={setSearch} placeholder={tr("Ism yoki lavozim")} />
      <SheetSection footer={tr("Ro'yxatda kabineti bor tarbiyachi va oshpazlar — xabar ularning «Xabarlar» sahifasiga tushadi.")}>
        {query.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner className="h-5 w-5 text-[#8e8e93]" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-4 text-[14px] text-[#8e8e93]">{tr("Hech narsa topilmadi")}</p>
        ) : (
          rows.map((e) => (
            <ChoiceRow
              key={e.id}
              checked={selected.has(e.id)}
              onClick={() => toggle(e)}
              leading={<IosIcon icon={IdCard} tint="indigo" size={30} />}
              label={e.fullName}
              subtitle={tr(e.position)}
            />
          ))
        )}
      </SheetSection>
    </IosSheet>
  );
}
