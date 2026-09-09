export default function RootPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)] text-xl font-bold text-white">
          B
        </div>
        <h1 className="text-lg font-semibold text-[var(--color-text)]">Tashkilot havolasi kerak</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          Bu yerga kirish uchun tashkilotingizga tegishli havoladan foydalaning, masalan:{" "}
          <code className="rounded-[var(--radius-xs)] bg-[var(--color-surface-sunken)] px-1.5 py-0.5 text-xs">/tashkilot-nomi</code>. Havolani Platform Admin
          tashkilot yaratganda sizga taqdim etadi.
        </p>
      </div>
    </div>
  );
}
