"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { EmployeeTopic } from "@/lib/types";
import { CloseIcon, PlusIcon } from "@/components/ios/icons";
import { IosSwitch } from "@/components/ios/form";
import { GROUP_BLOCK, ROW_SEPARATOR, SECTION_TITLE } from "@/components/ios/tokens";
import { useTr } from "@/i18n/tr";

/**
 * Xodim tafsilot oynasidagi "Mavzu qo'shasizmi?" bo'limi — faqat dars
 * o'tadigan (Fan o'qituvchisi) xodimlarda ko'rinadi. Almashtirgich
 * `Employee.topicsManagedByAdmin`ni boshqaradi: yoqilsa, administrator
 * mavzularni shu yerdan markazlashtirib boshqaradi va xodimning o'zi
 * "Savol-javob" sahifasida ("/my-lessons/topics") yangi mavzu qo'sha olmay
 * qoladi (serverda ham bloklangan). O'chirilgan bo'lsa — o'qituvchining o'zi
 * qo'sha oladi. Almashtirgichning holati o'zining alohida "Saqlash" tugmasi
 * bilan emas, balki oynaning tagidagi yagona "Saqlash" tugmasi bilan
 * saqlanadi — shu sababli holat va uni saqlash logikasi ota komponentda
 * (`EmployeeDetailModal`) yashaydi, bu yerga faqat controlled prop sifatida
 * beriladi.
 */
export function EmployeeTopics({
  slug,
  employeeId,
  managedByAdmin,
  onManagedByAdminChange,
}: {
  slug: string;
  employeeId: string;
  managedByAdmin: boolean;
  onManagedByAdminChange: (value: boolean) => void;
}) {
  const tr = useTr();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [inputFocused, setInputFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topicsQuery = useQuery({
    queryKey: ["employee-topics", slug, employeeId],
    queryFn: () => api.get<EmployeeTopic[]>(`/app/employees/${employeeId}/topics`),
  });
  const suggestionsQuery = useQuery({
    queryKey: ["employee-topic-suggestions", slug, employeeId],
    queryFn: () => api.get<string[]>(`/app/employees/${employeeId}/topics/suggestions`),
  });

  const topics = topicsQuery.data ?? [];
  const isOn = managedByAdmin;

  const addMutation = useMutation({
    mutationFn: (title: string) => api.post<EmployeeTopic>(`/app/employees/${employeeId}/topics`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-topics", slug, employeeId] });
      setValue("");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : tr("Mavzuni qo'shib bo'lmadi"));
    },
  });

  const removeMutation = useMutation({
    mutationFn: (topicId: string) => api.delete(`/app/employees/${employeeId}/topics/${topicId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-topics", slug, employeeId] });
      setSelectedId(null);
    },
  });

  const existingTitles = useMemo(() => new Set(topics.map((topic) => topic.title.toLowerCase())), [topics]);
  const suggestions = (suggestionsQuery.data ?? []).filter(
    (subject) =>
      !existingTitles.has(subject.toLowerCase()) && subject.toLowerCase().includes(value.trim().toLowerCase()),
  );

  const submit = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed || addMutation.isPending) return;
    addMutation.mutate(trimmed);
  };

  return (
    <section>
      <h3 className={SECTION_TITLE}>{tr("Mavzular")}</h3>
      <div className={GROUP_BLOCK}>
        <div className="group/row relative flex min-h-[52px] items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] text-[var(--color-text)]">{tr("Mavzu qo'shasizmi?")}</span>
            <span className="block text-[12.5px] leading-snug text-[#8e8e93]">
              {tr("O'tilgan yoki o'tiladigan dars mavzularini shu yerga qo'shib boring.")}
            </span>
          </span>
          <IosSwitch checked={isOn} onChange={onManagedByAdminChange} label={tr("Mavzu qo'shasizmi?")} />
        </div>

        {isOn && (
          <>
            <div className="group/row relative px-4">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setTimeout(() => setInputFocused(false), 150)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submit(value);
                  }
                }}
                placeholder={tr("Mavzu nomini kiriting va Enter bosing...")}
                disabled={addMutation.isPending}
                className="w-full bg-transparent py-3 text-[15px] text-[var(--color-text)] outline-none placeholder:text-[#c4c4c6] disabled:opacity-50"
              />
              <span className={ROW_SEPARATOR} aria-hidden="true" />
            </div>
            {inputFocused &&
              suggestions.map((subject) => (
                <div key={subject} className="group/row relative">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => submit(subject)}
                    className="flex min-h-[44px] w-full items-center gap-2 px-4 text-left text-[15px] text-[var(--color-primary)] transition-colors hover:bg-[#767680]/[0.05] active:bg-[#767680]/[0.1]"
                  >
                    <PlusIcon className="h-4 w-4 shrink-0" strokeWidth={2.4} />
                    <span className="truncate">{tr(subject)}</span>
                  </button>
                  <span className={ROW_SEPARATOR} aria-hidden="true" />
                </div>
              ))}

            <div className="group/row relative px-4 py-3">
              {topicsQuery.isLoading ? (
                <p className="text-[13px] text-[#8e8e93]">{tr("Yuklanmoqda...")}</p>
              ) : topics.length === 0 ? (
                <p className="text-[13px] text-[#8e8e93]">{tr("Hali mavzu qo'shilmagan")}</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {topics.map((topic) => {
                    const selected = selectedId === topic.id;
                    return (
                      <span
                        key={topic.id}
                        onClick={() => setSelectedId(selected ? null : topic.id)}
                        className={clsx(
                          "flex h-8 cursor-pointer items-center gap-1 rounded-full px-3 text-[13.5px] transition-colors",
                          selected
                            ? "bg-[var(--color-primary)]/[0.12] font-medium text-[var(--color-primary)]"
                            : "bg-[#767680]/[0.12] text-[var(--color-text)]",
                        )}
                      >
                        {tr(topic.title)}
                        {selected && (
                          <button
                            type="button"
                            aria-label={tr("Mavzuni o'chirish")}
                            disabled={removeMutation.isPending}
                            onClick={(e) => {
                              e.stopPropagation();
                              removeMutation.mutate(topic.id);
                            }}
                            className="-mr-1 flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[#ff3b30] disabled:opacity-50"
                          >
                            <CloseIcon className="h-3.5 w-3.5" strokeWidth={2.6} />
                          </button>
                        )}
                      </span>
                    );
                  })}
                </div>
              )}
              <span className={ROW_SEPARATOR} aria-hidden="true" />
            </div>
          </>
        )}
      </div>
      {isOn && (
        <p className={clsx("px-4 pt-2 text-[12.5px] leading-snug", error ? "text-[#ff3b30]" : "text-[#8e8e93]")}>
          {error ? tr(error) : tr("Mavzuni o'chirish uchun ustiga bosing.")}
        </p>
      )}
    </section>
  );
}
