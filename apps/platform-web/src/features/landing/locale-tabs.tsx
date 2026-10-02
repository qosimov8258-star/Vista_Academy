export const LOCALE_TABS = [
  { key: "uz", label: "O'zbekcha" },
  { key: "ru", label: "Ruscha" },
  { key: "en", label: "Inglizcha" },
] as const;
export type LocaleTabKey = (typeof LOCALE_TABS)[number]["key"];

/** Uz/Ru/En matnli maydonlar orasida almashish uchun kichik segment tugmalari. */
export function LocaleTabs({ active, onChange }: { active: LocaleTabKey; onChange: (key: LocaleTabKey) => void }) {
  return (
    <div className="inline-flex rounded-[var(--radius-md)] bg-[var(--color-surface-sunken)] p-0.5">
      {LOCALE_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onChange(tab.key)}
          className={`rounded-[calc(var(--radius-md)-2px)] px-3 py-1 text-[12px] font-semibold transition-colors ${
            active === tab.key
              ? "bg-[var(--color-surface)] text-[var(--color-text)] shadow-sm"
              : "text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
