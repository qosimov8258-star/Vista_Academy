"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { Room } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";

/**
 * Xonalar katalogi alohida nav bandiga ega emas — dars jadvali sahifasidan
 * shu oyna orqali boshqariladi (guruh/xodim tanlashda kerak bo'lgan ro'yxat
 * shu yerda to'ldiriladi).
 */
export function ManageRoomsModal({
  open,
  onClose,
  slug,
  branchId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  branchId: string | null;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [deletingRoom, setDeletingRoom] = useState<Room | null>(null);

  const roomsQuery = useQuery({
    queryKey: ["rooms", slug, branchId],
    queryFn: () => api.get<Room[]>(`/app/rooms${branchId ? `?branchId=${branchId}` : ""}`),
    enabled: open,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["rooms", slug] });

  const createMutation = useMutation({
    mutationFn: (value: string) => api.post<Room>("/app/rooms", { name: value }),
    onSuccess: () => {
      invalidate();
      setName("");
      setCreateError(null);
    },
    onError: (err) => setCreateError(err instanceof ApiError ? err.message : "Xonani yaratib bo'lmadi"),
  });

  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; name: string }) => api.patch<Room>(`/app/rooms/${vars.id}`, { name: vars.name }),
    onSuccess: () => {
      invalidate();
      setEditingId(null);
      setRowError(null);
    },
    onError: (err) => setRowError(err instanceof ApiError ? err.message : "Xonani saqlab bo'lmadi"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/app/rooms/${id}`),
    onSuccess: () => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["lesson-schedules", slug] });
      setDeletingRoom(null);
    },
    onError: (err) => setRowError(err instanceof ApiError ? err.message : "Xonani o'chirib bo'lmadi"),
  });

  const handleCreate = () => {
    const trimmed = name.trim();
    if (trimmed.length < 1) {
      setCreateError("Xona nomini kiriting");
      return;
    }
    createMutation.mutate(trimmed);
  };

  const handleClose = () => {
    setName("");
    setCreateError(null);
    setEditingId(null);
    setRowError(null);
    onClose();
  };

  const rooms = roomsQuery.data ?? [];

  return (
    <>
      <Modal open={open} onClose={handleClose} title="Xonalar" widthClassName="max-w-md">
        <div className="space-y-5">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Input
                label="Yangi xona nomi"
                placeholder="1-xona"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setCreateError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleCreate();
                  }
                }}
                error={createError ?? undefined}
              />
            </div>
            <Button type="button" onClick={handleCreate} loading={createMutation.isPending}>
              Qo&apos;shish
            </Button>
          </div>

          <div>
            <span className="mb-2 block text-sm font-medium text-[var(--color-text)]">Mavjud xonalar</span>
            {rowError && (
              <div className="mb-2 rounded-lg bg-[var(--color-danger-bg)] px-3 py-2 text-[13px] text-[var(--color-danger)]">
                {rowError}
              </div>
            )}
            {roomsQuery.isLoading ? (
              <p className="text-xs text-[var(--color-text-muted)]">Yuklanmoqda...</p>
            ) : rooms.length === 0 ? (
              <p className="text-xs text-[var(--color-text-muted)]">Hozircha xona yo&apos;q — yuqoridan yarating</p>
            ) : (
              <ul className="divide-y divide-[var(--color-separator)] overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-hair)]">
                {rooms.map((room) => (
                  <li key={room.id} className="flex items-center gap-2 px-3 py-2">
                    {editingId === room.id ? (
                      <>
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              const trimmed = editingName.trim();
                              if (trimmed.length < 1) {
                                setRowError("Xona nomini kiriting");
                                return;
                              }
                              updateMutation.mutate({ id: room.id, name: trimmed });
                            }
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          className="h-9 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-hair)] bg-[var(--color-surface)] px-2.5 text-[14px] text-[var(--color-text)] outline-none focus:border-[var(--color-primary)]"
                        />
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const trimmed = editingName.trim();
                            if (trimmed.length < 1) {
                              setRowError("Xona nomini kiriting");
                              return;
                            }
                            updateMutation.mutate({ id: room.id, name: trimmed });
                          }}
                          loading={updateMutation.isPending && updateMutation.variables?.id === room.id}
                        >
                          Saqlash
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 truncate text-[14px] text-[var(--color-text)]">{room.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingId(room.id);
                            setEditingName(room.name);
                            setRowError(null);
                          }}
                          aria-label="Xona nomini tahrirlash"
                          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-sunken)] hover:text-[var(--color-text)]"
                        >
                          <PencilIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRowError(null);
                            setDeletingRoom(room);
                          }}
                          aria-label="Xonani o'chirish"
                          className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-danger-bg)] hover:text-[var(--color-danger)]"
                        >
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button type="button" variant="secondary" onClick={handleClose}>
              Yopish
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deletingRoom}
        onClose={() => setDeletingRoom(null)}
        title="Xonani o'chirish"
        confirmLabel="O'chirish"
        tone="danger"
        loading={deleteMutation.isPending}
        error={rowError}
        description={
          <>
            <b className="text-[var(--color-text)]">{deletingRoom?.name}</b> o&apos;chiriladi va shu xonaga
            bog&apos;liq dars jadvali qatorlari ham olib tashlanadi.
          </>
        }
        onConfirm={() => deletingRoom && deleteMutation.mutate(deletingRoom.id)}
      />
    </>
  );
}
