export function LoadingState({ label = "Yuklanmoqda..." }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-[var(--color-text-muted)]">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      {label}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger-bg)] py-12 text-center">
      <p className="text-sm font-medium text-[var(--color-danger)]">Xatolik yuz berdi</p>
      <p className="text-sm text-[var(--color-danger)]/80">{message}</p>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-[var(--color-border)] py-16 text-center">
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      {description && <p className="text-sm text-[var(--color-text-muted)]">{description}</p>}
    </div>
  );
}
