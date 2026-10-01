import { Card } from "@/components/ui/card";
import type { BoardResult } from "./shared";
import { useTr } from "@/i18n/tr";

export function BoardTiles({ board }: { board: BoardResult }) {
  const tr = useTr();
  const t = board.totals;
  const tile = (label: string, value: number | string, hint?: string) => (
    <Card className="p-4">
      <p className="text-[12.5px] text-[var(--color-text-muted)]">{tr(label)}</p>
      <p className="mt-1 text-[24px] font-semibold tabular-nums text-[var(--color-text)]">{tr(value)}</p>
      {hint && <p className="text-[12px] text-[var(--color-text-muted)]">{tr(hint)}</p>}
    </Card>
  );
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      {tile("Kelgan bolalar", `${t.present} / ${t.total}`, t.notMarked > 0 ? tr("{0} tasi belgilanmagan", t.notMarked) : undefined)}
      {tile("Kelmagan / kasal", `${t.absent} / ${t.sick}`)}
      {tile(tr("Hozir bog'chada"), board.stillHere, tr("{0} tasi olib ketilgan", t.pickedUp))}
      {tile("Ovqat tayyorlanadi", board.mealCount, "kelgan + kechikkanlar")}
      {tile("Kelmagan xodimlar", board.staffAway.length)}
    </div>
  );
}
