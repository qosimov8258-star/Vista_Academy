"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import type { Position } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * "Yangi xodim" modalidagi Lavozim pill'i bosilganda ochiladi. Yangi lavozim
 * yaratish va mavjudlaridan birini tanlash shu yerda — tanlangach, avtomatik
 * yopilib, "Yangi xodim" modaliga qaytadi (pill'da tanlangan nom ko'rinadi).
 */
export function PositionsModal({
  open,
  onClose,
  slug,
  selected,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  selected?: string;
  onSelect: (name: string) => void;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { data: positions } = useQuery({
    queryKey: ["positions", slug],
    queryFn: () => api.get<Position[]>("/app/positions"),
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (value: string) => api.post<Position>("/app/positions", { name: value }),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["positions", slug] });
      setName("");
      setError(null);
      onSelect(created.name);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : "Lavozim yaratib bo'lmadi");
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
      setError("Lavozim nomi kamida 2 belgi");
      return;
    }
    createMutation.mutate(trimmed);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Lavozimlar" widthClassName="max-w-md">
      <div className="space-y-5">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Lavozim nomi"
              placeholder="Masalan, Hovli farroshi"
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
          <span className="mb-2 block text-sm font-medium text-[var(--color-text)]">Mavjud lavozimlar</span>
          {!positions ? (
            <p className="text-xs text-[var(--color-text-muted)]">Yuklanmoqda...</p>
          ) : positions.length === 0 ? (
            <p className="text-xs text-[var(--color-text-muted)]">Hozircha lavozim yo&apos;q — yuqoridan yarating</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {positions.map((position) => {
                const isSelected = position.name === selected;
                return (
                  <button
                    key={position.id}
                    type="button"
                    onClick={() => {
                      onSelect(position.name);
                      onClose();
                    }}
                    aria-pressed={isSelected}
                    className={clsx(
                      "cursor-pointer rounded-full border px-3.5 py-1.5 text-[13px] transition-colors",
                      isSelected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]",
                    )}
                  >
                    {position.name}
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
