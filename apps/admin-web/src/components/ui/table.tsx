import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import clsx from "clsx";

/**
 * Ro'yxat jadvali. Ilgari har sahifa o'z jadvalini yozardi va hammasi
 * `bg-gray-50` sarlavha + qattiq 1px chiziq bilan chiqardi — bu ko'rinishning
 * eng "veb" joyi edi. Bu yerda sarlavha cho'kkan yuzada, ajratkichlar soch
 * chizig'ida, qator ustiga borilganda esa sarlavhadan farq qiladigan rangda
 * yoritiladi.
 *
 * Ishlatilishi:
 *   <DataTable>
 *     <THead><tr><Th>Nomi</Th><Th numeric>Summa</Th></tr></THead>
 *     <TBody>{rows.map(r => <Tr key={r.id}><Td>{r.name}</Td><Td numeric>{r.sum}</Td></Tr>)}</TBody>
 *   </DataTable>
 */
export function DataTable({ className, children, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto">
      {/* Eng kichik kenglik: ustunlar siqilib, summa va sana ikki qatorga
          sinib ketgandan ko'ra jadvalni yon tomonga surish afzal. */}
      <table className={clsx("w-full min-w-[680px] text-left", className)} {...props}>
        {children}
      </table>
    </div>
  );
}

export function THead({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={clsx(
        "bg-[var(--color-surface-sunken)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--color-text-muted)]",
        className,
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={clsx("divide-y divide-[var(--color-separator)]", className)} {...props} />;
}

export function Tr({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={clsx("transition-colors duration-100 hover:bg-[var(--color-surface-hover)]", className)}
      {...props}
    />
  );
}

export function Th({
  className,
  numeric,
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={clsx(
        "whitespace-nowrap px-5 py-3 font-semibold first:pl-6 last:pr-6",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  nowrap,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean; nowrap?: boolean }) {
  return (
    <td
      className={clsx(
        "px-5 py-3.5 text-[14px] text-[var(--color-text)] first:pl-6 last:pr-6",
        // Raqam va sana hech qachon sinmasin — ular bir butun o'qiladi
        numeric ? "whitespace-nowrap text-right tabular-nums" : nowrap && "whitespace-nowrap",
        className,
      )}
      {...props}
    />
  );
}
