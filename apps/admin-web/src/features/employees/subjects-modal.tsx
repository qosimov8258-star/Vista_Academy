"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { Subject } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * "Yangi xodim" modalidagi Fanlar pill'i bosilganda ochiladi. Lavozimlar
 * modali bilan bir xil dizayn — farqi shundaki, bir nechta fan tanlash
 * mumkin, shuning uchun pill bosilganda modal yopilmaydi, faqat tanlov
 * holati almashadi.
 */
export function SubjectsModal({
  open,
  onClose,
  slug,
  selected,
  onToggle,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  selected: string[];
  onToggle: (name: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: subjects } = useQuery({
    queryKey: ["subjects", slug],
    queryFn: () => api.get<Subject[]>("/app/subjects"),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (value: string) => api.post<Subject>("/app/subjects", { name: value }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["subjects", slug] });
      setName("");
      setError(null);
      onToggle(created.name);
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Fan yaratib bo'lmadi");
    },
  });

  const handleClose = () => {
    setName("");
    setError(null);
    onClose();
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("Fan nomi kamida 2 belgi");
      return;
    }
    createMutation.mutate(trimmed);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Fanlar" widthClassName="max-w-md">
      <div className="space-y-5">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Fan nomi"
              placeholder="Masalan, Rus tili"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleCreate();
                }
              }}
              error={error ?? undefined}
            />
          </div>
          <Button type="button" onClick={handleCreate} loading={createMutation.isPending}>
            Yaratish
          </Button>
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-[var(--color-text)]">Mavjud fanlar</span>
          {!subjects ? (
            <p className="text-xs text-[var(--color-text-muted)]">Yuklanmoqda...</p>
          ) : subjects.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Hozircha fan yo&apos;q — yuqoridan yarating</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {subjects.map((subject) => {
                const isSelected = selected.includes(subject.name);
                return (
                  <button
                    key={subject.id}
                    type="button"
                    onClick={() => onToggle(subject.name)}
                    aria-pressed={isSelected}
                    className={clsx(
                      "cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                      isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]",
                    )}
                  >
                    {subject.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Yopish
          </Button>
        </div>
      </div>
    </Modal>
  );
}
