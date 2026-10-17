"use client";

import { useState } from "react";
import clsx from "clsx";
import type { Employee } from "@/lib/types";
import { EmployeePhoto } from "@/components/ui/employee-photo";
import { initials } from "@/components/ui/avatar";
import { ChevronsUpDown } from "@/components/ios/form";
import { CheckIcon, ChevronRightIcon, GroupIcon } from "@/components/ios/icons";
import { IosSheet, SheetSection } from "@/components/ios/sheet";
import { SkeletonRows } from "@/components/ios/states";
import { ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

/**
 * Xodim tanlagichi (native `<select>` o'rniga): bosilsa ichki varaqda
 * xodimlar ro'yxati ochiladi, tanlangani ✓ bilan, tanlangach o'zi yopiladi.
 * `variant="row"` — forma qatori ichida (o'ngda nom va «›»),
 * `variant="pill"` — sarlavha yonidagi filtr kapsulasi.
 */
export function EmployeePicker({
  id,
  title,
  value,
  onChange,
  employees,
  loading = false,
  placeholder,
  allOption,
  variant = "row",
}: {
  id?: string;
  title: string;
  value: string;
  onChange: (value: string) => void;
  employees: Employee[];
  loading?: boolean;
  /** Hech kim tanlanmaganda ko'rinadigan matn */
  placeholder: string;
  /** Berilsa — ro'yxat boshida "hammasi" varianti (qiymati bo'sh satr) */
  allOption?: string;
  variant?: "row" | "pill";
}) {
  const tr = useTr();
  const [open, setOpen] = useState(false);
  const selected = employees.find((employee) => employee.id === value);
  const pick = (next: string) => {
    if (next !== value) onChange(next);
    setOpen(false);
  };
  const label = selected ? tr(selected.fullName) : placeholder;

  const row = (key: string, active: boolean, onClick: () => void, leading: React.ReactNode, name: string, hint?: string) => (
    <div key={key} className="group/row relative">
      <button
        type="button"
        role="radio"
        aria-checked={active}
        onClick={onClick}
        className={clsx("flex min-h-[52px] w-full items-center gap-3 px-4 py-2 text-left", ROW_PRESS)}
      >
        {leading}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] text-[var(--color-text)]">{name}</span>
          {hint && <span className="block truncate text-[13px] text-[#8e8e93]">{hint}</span>}
        </span>
        {active && <CheckIcon className="h-5 w-5 shrink-0 text-[var(--color-primary)]" strokeWidth={2.6} />}
      </button>
      <span className={ROW_SEPARATOR} style={{ left: 58 }} aria-hidden="true" />
    </div>
  );

  return (
    <>
      {variant === "pill" ? (
        <button
          id={id}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className={clsx(
            "inline-flex h-8 min-w-0 max-w-[124px] items-center sm:max-w-[220px] gap-1.5 rounded-full pl-3 pr-2.5 text-[13px] font-medium normal-case tracking-normal transition-colors",
            value ? "bg-[var(--color-primary)]/12 text-[var(--color-primary)]" : "bg-[#767680]/[0.12] text-[var(--color-text)] hover:bg-[#767680]/[0.18]",
          )}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
        </button>
      ) : (
        <button
          id={id}
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          className="flex min-h-[44px] w-full items-center justify-end gap-1.5 text-right transition-opacity active:opacity-50"
        >
          <span className={clsx("min-w-0 truncate text-[15px]", selected ? "text-[var(--color-text)]" : "text-[#8e8e93]")}>{label}</span>
          <ChevronRightIcon className="h-4 w-4 shrink-0 text-[#c4c4c6]" strokeWidth={2.4} />
        </button>
      )}

      <IosSheet open={open} onClose={() => setOpen(false)} title={title} cancelLabel="Orqaga">
        {loading ? (
          <SkeletonRows rows={4} />
        ) : (
          <SheetSection footer={employees.length === 0 ? tr("Xodim topilmadi") : undefined}>
            <div role="radiogroup" aria-label={title}>
              {allOption &&
                row(
                  "all",
                  value === "",
                  () => pick(""),
                  <span aria-hidden="true" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#8e8e93] text-white">
                    <GroupIcon className="h-[15px] w-[15px]" />
                  </span>,
                  allOption,
                )}
              {employees.map((employee) =>
                row(
                  employee.id,
                  employee.id === value,
                  () => pick(employee.id),
                  <EmployeePhoto employee={employee} size={30} shape="circle" fallback={initials(employee.fullName)} className="text-[11px]" />,
                  tr(employee.fullName),
                  tr(employee.position),
                ),
              )}
            </div>
          </SheetSection>
        )}
      </IosSheet>
    </>
  );
}
