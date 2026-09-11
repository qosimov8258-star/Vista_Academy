"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { EmployeeTopic } from "@/lib/types";
import { CloseIcon } from "@/components/ui/icons";

/**
 * Xodim tafsilot oynasidagi "Mavzu qo'shasizmi?" bo'limi — faqat dars
 * o'tadigan (Fan o'qituvchisi) xodimlarda ko'rinadi. O'chirib-yoqish
 * shunchaki bu bo'limni yashiradi/ko'rsatadi; mavzular backendda saqlanadi
 * va yopib-ochilganda yo'qolmaydi. Mavjud mavzu bo'lsa, ochilganda bo'lim
 * avtomatik ko'rinadi.
 */
export function EmployeeTopics({ slug, employeeId }: { slug: string; employeeId: string }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<boolean | null>(null);
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
  // Foydalanuvchi hali tugmani bosmagan bo'lsa — mavjud mavzular asosida sukut holat.
  const isOn = expanded ?? topics.length > 0;

  const addMutation = useMutation({
    mutationFn: (title: string) => api.post<EmployeeTopic>(`/app/employees/${employeeId}/topics`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employee-topics", slug, employeeId] });
      setValue("");
      setError(null);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Mavzuni qo'shib bo'lmadi");
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
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] p-4">
      <label className="flex cursor-pointer items-center justify-between gap-3">
        <span>
          <span className="block text-sm font-medium text-[var(--color-text)]">Mavzu qo&apos;shasizmi?</span>
          <span className="block text-xs text-[var(--color-text-muted)]">
            O&apos;tilgan yoki o&apos;tiladigan dars mavzularini shu yerga qo&apos;shib boring.
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={isOn}
          aria-label="Mavzu qo'shasizmi?"
          onClick={() => setExpanded(!isOn)}
          className={clsx(
            "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors duration-[var(--dur-fast)]",
            isOn ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]",
          )}
        >
          <span
            className={clsx(
              "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-[var(--dur-fast)]",
              isOn && "translate-x-5",
            )}
          />
        </button>
      </label>

      {isOn && (
        <div className="mt-3.5 space-y-3 border-t border-[var(--color-border)] pt-3.5">
          {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}

          <div className="relative">
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
              placeholder="Mavzu nomini kiriting va Enter bosing..."
              disabled={addMutation.isPending}
              className="w-full rounded-2xl border border-[var(--color-border)] bg-white px-3.5 py-2.5 text-sm text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-primary)] disabled:opacity-60"
            />
            {inputFocused && suggestions.length > 0 && (
              <div className="absolute z-10 mt-1.5 max-h-48 w-full overflow-y-auto rounded-2xl border border-[var(--color-border)] bg-white p-1.5 shadow-lg">
                {suggestions.map((subject) => (
                  <button
                    key={subject}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => submit(subject)}
                    className="block w-full cursor-pointer rounded-xl px-3 py-2 text-left text-sm text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]"
                  >
                    {subject}
                  </button>
                ))}
              </div>
            )}
          </div>

          {topicsQuery.isLoading ? (
            <p className="text-xs text-[var(--color-text-muted)]">Yuklanmoqda...</p>
          ) : topics.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Hali mavzu qo&apos;shilmagan</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {topics.map((topic) => {
                const selected = selectedId === topic.id;
                return (
                  <span
                    key={topic.id}
                    onClick={() => setSelectedId(selected ? null : topic.id)}
                    className={clsx(
                      "flex cursor-pointer items-center gap-1 rounded-full px-3 py-1.5 text-[13px] transition-colors",
                      selected
                        ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)] ring-1 ring-inset ring-[var(--color-primary)]/30"
                        : "bg-[var(--color-surface-sunken)] text-[var(--color-text)] hover:bg-[var(--color-border)]",
                    )}
                  >
                    {topic.title}
                    {selected && (
                      <button
                        type="button"
                        aria-label="Mavzuni o'chirish"
                        disabled={removeMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          removeMutation.mutate(topic.id);
                        }}
                        className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)] disabled:opacity-50"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
