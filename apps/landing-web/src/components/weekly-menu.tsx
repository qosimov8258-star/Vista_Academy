"use client";

import { useState } from "react";
import { assetUrl } from "@/lib/api";
import type { LandingMeal, LandingMealType, LandingWeekday } from "@/lib/types";

const WEEKDAYS: LandingWeekday[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

const WEEKDAY_LABELS: Record<LandingWeekday, string> = {
  MONDAY: "Dushanba",
  TUESDAY: "Seshanba",
  WEDNESDAY: "Chorshanba",
  THURSDAY: "Payshanba",
  FRIDAY: "Juma",
  SATURDAY: "Shanba",
  SUNDAY: "Yakshanba",
};

const TYPE_LABELS: Record<LandingMealType, string> = {
  BREAKFAST: "Nonushta",
  LUNCH: "Tushlik",
  SNACK: "Ikkinchi nonushta",
  DINNER: "Kechki ovqat",
  OTHER: "Boshqa",
};

const TYPE_ICONS: Partial<Record<LandingMealType, string>> = {
  BREAKFAST: "/taom/nonushta.png",
  LUNCH: "/taom/tushlik.png",
  SNACK: "/taom/ikkinchi-tushlik.png",
  DINNER: "/taom/kechki.png",
};

/** JS'dagi getDay() (0=yakshanba) ni haftani dushanbadan boshlaydigan tartibga o'giradi. Yakshanba menyuda yo'q — shunda dushanba tanlanadi. */
function todayWeekday(): LandingWeekday {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? "MONDAY" : WEEKDAYS[jsDay - 1];
}

function MealCard({ meal }: { meal: LandingMeal }) {
  const items = meal.title
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const iconSrc = (meal.photoPath && assetUrl(meal.photoPath)) || TYPE_ICONS[meal.mealType] || null;

  return (
    <div className="flex items-center gap-4 rounded-[var(--radius-xl)] bg-white px-4 py-3 shadow-[var(--shadow-card)]">
      <div
        className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-lg)]"
        style={{ background: "var(--color-tint)" }}
      >
        {iconSrc ? (
          // eslint-disable-next-line @next/next/no-img-element -- taom turi bo'yicha statik yoki API'dan kelgan dinamik rasm
          <img src={iconSrc} alt={TYPE_LABELS[meal.mealType]} className="h-9 w-9 object-contain" />
        ) : (
          <span className="text-[22px]" aria-hidden="true">
            🍽️
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {meal.time && (
            <span
              className="rounded-full px-2.5 py-1 text-[12px] font-extrabold text-white"
              style={{ background: "var(--color-blue)" }}
            >
              {meal.time}
            </span>
          )}
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-extrabold"
            style={{ background: "var(--color-tint)", color: "var(--color-blue-dark)" }}
          >
            {TYPE_LABELS[meal.mealType]}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((item, index) => (
            <span
              key={index}
              className="font-heading rounded-[var(--radius-md)] px-2.5 py-1 text-[13px] font-extrabold text-[var(--color-text)]"
              style={{ background: "var(--color-tint)" }}
            >
              {item}
            </span>
          ))}
        </div>
        {meal.description && (
          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--color-text-muted)]">{meal.description}</p>
        )}
      </div>
    </div>
  );
}

export function WeeklyMenu({ meals }: { meals: LandingMeal[] }) {
  const [active, setActive] = useState<LandingWeekday>(() => todayWeekday());

  const byDay = new Map<LandingWeekday, LandingMeal[]>(WEEKDAYS.map((day) => [day, []]));
  const unscheduled: LandingMeal[] = [];
  for (const meal of meals) {
    if (meal.weekday && byDay.has(meal.weekday)) byDay.get(meal.weekday)!.push(meal);
    else unscheduled.push(meal);
  }
  for (const list of byDay.values()) {
    list.sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  }

  const activeMeals = byDay.get(active) ?? [];

  return (
    <div>
      <div className="flex flex-wrap justify-center gap-2">
        {WEEKDAYS.map((day) => {
          const count = byDay.get(day)!.length;
          const isActive = day === active;
          return (
            <button
              key={day}
              type="button"
              onClick={() => setActive(day)}
              className="shrink-0 rounded-full px-4 py-2.5 text-[14px] font-bold transition-colors"
              style={
                isActive
                  ? { background: "linear-gradient(135deg, var(--color-green) 0%, var(--color-green-dark) 100%)", color: "white" }
                  : { background: "var(--color-tint)", color: "var(--color-text-muted)" }
              }
            >
              {WEEKDAY_LABELS[day]}
              {count > 0 && <span className="ml-1.5 opacity-75">({count})</span>}
            </button>
          );
        })}
      </div>

      <div className="mx-auto mt-8 grid max-w-[760px] grid-cols-1 gap-4">
        {activeMeals.length === 0 ? (
          <p className="py-10 text-center text-[15px] text-[var(--color-text-muted)]">
            {WEEKDAY_LABELS[active]} kuni uchun menyu hali kiritilmagan.
          </p>
        ) : (
          activeMeals.map((meal) => <MealCard key={meal.id} meal={meal} />)
        )}
      </div>

      {unscheduled.length > 0 && (
        <div className="mx-auto mt-12 max-w-[760px]">
          <p className="text-[13px] font-bold uppercase tracking-[0.08em]" style={{ color: "var(--color-blue)" }}>
            Boshqa taomlar
          </p>
          <div className="mt-4 grid grid-cols-1 gap-4">
            {unscheduled.map((meal) => (
              <MealCard key={meal.id} meal={meal} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
