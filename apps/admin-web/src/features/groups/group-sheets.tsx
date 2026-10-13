"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { Check, Minus, Plus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Employee, Group, GroupStatus } from "@/lib/types";
import { SearchPill } from "@/components/ios/filters";
import { Segmented } from "@/components/ios/form";
import { IosAvatar, Pill } from "@/components/ios/pill";
import { IosSheet, SheetPrimaryButton, SheetSection } from "@/components/ios/sheet";
import { SkeletonRows } from "@/components/ios/states";
import { IOS, ROW_PRESS, ROW_SEPARATOR } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

const TINTS = ["#007aff", "#34c759", "#ff9500", "#af52de", "#ff2d55", "#30b0c7", "#5856d6", "#00c7be"];

/** Guruh nomidan doimiy rang — har guruh o'z rangida tanilsin */
export function groupTint(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

/** Guruh plitkasi: rangli kvadrat va nomning bosh harfi */
export function GroupTile({ name, size = 44 }: { name: string; size?: number }) {
  const letter = name.match(/[\p{L}\p{N}]/u)?.[0]?.toUpperCase() ?? "#";
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center font-bold text-white"
      style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: groupTint(name), fontSize: size * 0.42 }}
    >
      {letter}
    </span>
  );
}

/** Bolalar / sig'im chizig'i: to'lsa — to'q sariq, oshib ketsa — qizil */
export function CapacityBar({ count, capacity, className }: { count: number; capacity: number; className?: string }) {
  const ratio = capacity > 0 ? count / capacity : 0;
  const color = ratio > 1 ? IOS.red : ratio >= 0.9 ? IOS.orange : IOS.green;
  return (
    <span className={clsx("block h-1.5 overflow-hidden rounded-full bg-[#767680]/[0.14]", className)} aria-hidden="true">
      <span className="block h-full rounded-full" style={{ width: `${Math.min(100, ratio * 100)}%`, backgroundColor: color }} />
    </span>
  );
}

/**
 * Guruh yaratish / tahrirlash varag'i: nom, sig'im (− N +) va —
 * tahrirlashda — holat (Faol / Nofaol).
 */
export function GroupFormSheet({ open, onClose, slug, group }: { open: boolean; onClose: () => void; slug: string; group?: Group | null }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const editing = !!group;
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(20);
  const [status, setStatus] = useState<GroupStatus>("ACTIVE");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(group?.name ?? "");
    setCapacity(group?.capacity ?? 20);
    setStatus(group?.status ?? "ACTIVE");
    setTouched(false);
    setError(null);
  }, [open, group]);

  const nameError = name.trim().length < 2 ? tr("Nomi kamida 2 belgi") : null;
  const capacityError = capacity < 1 || capacity > 100 ? tr("Sig'im 1 dan 100 gacha") : null;

  const mutation = useMutation({
    mutationFn: () => {
      const body = { name: name.trim(), capacity };
      return editing ? api.patch<Group>(`/app/groups/${group!.id}`, { ...body, status }) : api.post<Group>("/app/groups", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["groups", slug] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary", slug] });
      if (group) {
        queryClient.invalidateQueries({ queryKey: ["group", slug, group.id] });
        queryClient.invalidateQueries({ queryKey: ["group-overview", slug, group.id] });
      }
      onClose();
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
  });

  const submit = () => {
    setTouched(true);
    if (nameError || capacityError) return;
    mutation.mutate();
  };

  const stepBtn = "flex h-9 w-9 items-center justify-center rounded-full text-[var(--color-text)] transition-transform active:scale-90 enabled:hover:bg-white disabled:opacity-30";
  return (
    <IosSheet
      open={open}
      onClose={() => !mutation.isPending && onClose()}
      title={editing ? tr("Guruhni tahrirlash") : tr("Yangi guruh")}
      footer={
        <SheetPrimaryButton onClick={submit} loading={mutation.isPending} dim={!!(nameError || capacityError)}>
          {editing ? tr("Saqlash") : tr("Yaratish")}
        </SheetPrimaryButton>
      }
    >
      <div className="flex justify-center pb-1">
        <GroupTile name={name.trim() || "?"} size={64} />
      </div>
      <SheetSection footer={touched && (nameError || capacityError) ? <span className="text-[#ff3b30]">{nameError ?? capacityError}</span> : tr("Masalan: «Kapalakchalar (3-4 yosh)»")}>
        <label className={clsx("group/row relative flex min-h-[52px] items-center gap-3 px-4", touched && nameError && "bg-[#ff3b30]/[0.06]")}>
          <span className="w-[96px] shrink-0 text-[15px] text-[var(--color-text)]">{tr("Nomi")}</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder={tr("Guruh nomi")}
            maxLength={80}
            autoFocus={!editing}
            className="min-w-0 flex-1 bg-transparent py-3 text-right text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6]"
          />
        </label>
        <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4">
          <span className="flex-1 text-[15px] text-[var(--color-text)]">{tr("Sig'imi")}</span>
          <div className="flex items-center rounded-full bg-[#767680]/[0.12] p-[3px]">
            <button type="button" className={stepBtn} disabled={capacity <= 1} onClick={() => setCapacity((c) => Math.max(1, c - 1))} aria-label={tr("Kamaytirish")}>
              <Minus className="h-4 w-4" strokeWidth={2.4} />
            </button>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={100}
              value={capacity}
              onChange={(e) => setCapacity(Number(e.target.value) || 0)}
              aria-label={tr("Sig'imi")}
              className="w-12 bg-transparent text-center text-[16px] font-semibold tabular-nums text-[var(--color-text)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button type="button" className={stepBtn} disabled={capacity >= 100} onClick={() => setCapacity((c) => Math.min(100, c + 1))} aria-label={tr("Ko'paytirish")}>
              <Plus className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </div>
          <span className={ROW_SEPARATOR} aria-hidden="true" />
        </div>
      </SheetSection>
      {editing && (
        <SheetSection title={tr("Holati")} footer={tr("Nofaol guruh ro'yxatda qoladi, lekin bosh sahifadagi «Faol guruhlar»ga kirmaydi.")}>
          <div className="p-3">
            <Segmented<GroupStatus>
              value={status}
              onChange={setStatus}
              label={tr("Holati")}
              options={[
                { value: "ACTIVE", label: tr("Faol") },
                { value: "INACTIVE", label: tr("Nofaol") },
              ]}
            />
          </div>
        </SheetSection>
      )}
      {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
    </IosSheet>
  );
}

/**
 * Tarbiyachilarni biriktirish varag'i: filial xodimlari, biriktirilganlar
 * tepada. Xodim faqat bitta guruhga biriktiriladi — boshqa guruhdagisi
 * tanlansa, u shu guruhga ko'chadi (izohda ko'rsatiladi).
 */
export function TeachersSheet({ open, onClose, slug, group }: { open: boolean; onClose: () => void; slug: string; group: Group | null }) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setSearch("");
      setError(null);
    }
  }, [open]);

  const employeesQuery = useQuery({
    queryKey: ["employees", slug, group?.branchId],
    queryFn: () => api.get<Employee[]>(`/app/employees?branchId=${group!.branchId}`),
    enabled: open && !!group,
  });

  const mutation = useMutation({
    mutationFn: ({ employee, assign }: { employee: Employee; assign: boolean }) =>
      api.patch<Employee>(`/app/employees/${employee.id}/groups`, { groupIds: assign ? [group!.id] : [] }),
    onMutate: ({ employee }) => setPendingId(employee.id),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["employees", slug, group?.branchId] });
      queryClient.invalidateQueries({ queryKey: ["group-overview", slug, group?.id] });
      queryClient.invalidateQueries({ queryKey: ["groups", slug] });
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : tr("Kutilmagan xatolik yuz berdi")),
    onSettled: () => setPendingId(null),
  });

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = (employeesQuery.data ?? []).filter((e) => !q || e.fullName.toLowerCase().includes(q) || e.position.toLowerCase().includes(q));
    const assigned = (e: Employee) => (e.teachingGroups ?? []).some((l) => l.groupId === group?.id);
    // Biriktirilganlar, so'ng tarbiyachi/o'qituvchilar, keyin qolgan xodimlar (oshpaz va h.k.)
    const teaching = (e: Employee) => /tarbiyachi|o['ʻ’]?qituvchi|pedagog|metodist/i.test(e.position);
    return [...list].sort(
      (a, b) =>
        Number(assigned(b)) - Number(assigned(a)) ||
        Number(b.isActive) - Number(a.isActive) ||
        Number(teaching(b)) - Number(teaching(a)) ||
        a.fullName.localeCompare(b.fullName),
    );
  }, [employeesQuery.data, search, group?.id]);

  return (
    <IosSheet open={open} onClose={onClose} title={group ? tr("Tarbiyachilar — {0}", group.name) : ""} cancelLabel="Yopish">
      <SearchPill value={search} onChange={setSearch} placeholder={tr("Ism yoki lavozim")} />
      {error && <p className="px-4 text-[13px] text-[#ff3b30]">{tr(error)}</p>}
      <SheetSection footer={tr("Xodim bitta guruhga biriktiriladi — boshqa guruhdagisi tanlansa, shu guruhga o'tadi.")}>
        {employeesQuery.isLoading ? (
          <SkeletonRows rows={4} />
        ) : rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[14px] text-[#8e8e93]">{tr("Xodim topilmadi")}</p>
        ) : (
          rows.map((e) => {
            const assigned = (e.teachingGroups ?? []).some((l) => l.groupId === group?.id);
            const other = (e.teachingGroups ?? []).find((l) => l.groupId !== group?.id);
            const canToggle = e.isActive || assigned;
            const pending = pendingId === e.id && mutation.isPending;
            return (
              <div key={e.id} className="group/row relative">
                <button
                  type="button"
                  disabled={!canToggle || mutation.isPending}
                  onClick={() => mutation.mutate({ employee: e, assign: !assigned })}
                  className={clsx("flex min-h-[60px] w-full items-center gap-3 px-4 py-2 text-left disabled:opacity-50", ROW_PRESS)}
                  aria-pressed={assigned}
                >
                  <IosAvatar name={e.fullName} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium text-[var(--color-text)]">{tr(e.fullName)}</span>
                    <span className="block truncate text-[12.5px] text-[#8e8e93]">
                      {[tr(e.position), !e.isActive ? tr("nofaol") : null, other && !assigned ? tr("hozir: {0}", other.group?.name ?? "boshqa guruh") : null].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <span
                    className={clsx(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors",
                      assigned ? "bg-[var(--color-primary)] text-white" : "ring-[1.5px] ring-inset ring-[#c7c7cc]",
                      pending && "animate-pulse",
                    )}
                  >
                    {assigned && <Check className="h-4 w-4" strokeWidth={3} />}
                  </span>
                </button>
                <span className={ROW_SEPARATOR} style={{ left: 68 }} aria-hidden="true" />
              </div>
            );
          })
        )}
      </SheetSection>
      {rows.some((e) => (e.teachingGroups ?? []).some((l) => l.groupId === group?.id)) && (
        <p className="px-4 text-[12.5px] text-[#8e8e93]">
          <Pill color={IOS.green}>{tr("{0} ta biriktirilgan", rows.filter((e) => (e.teachingGroups ?? []).some((l) => l.groupId === group?.id)).length)}</Pill>
        </p>
      )}
    </IosSheet>
  );
}
