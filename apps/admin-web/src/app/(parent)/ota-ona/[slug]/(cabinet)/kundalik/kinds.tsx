import type { Tone } from "../foydali/ui";
import type { DiaryActivityKind } from "./diary";

type IconProps = { className?: string };

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.9,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

/* Bog'cha uslubidagi sodda chizmalar — har bir mashg'ulot turi uchun bittadan */

function ArrivalIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="12" cy="10" r="3.2" />
      <path d="M12 3.2v1.6M5.5 5.8l1.1 1.1M18.5 5.8l-1.1 1.1M3.5 12h1.6M18.9 12h1.6" />
      <path d="M4 19.5h16M7.5 16.5c1.2-1.4 2.7-2.1 4.5-2.1s3.3.7 4.5 2.1" />
    </svg>
  );
}

function LessonIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 6.5c-1.8-1.3-4.3-1.8-7.5-1.5v12.5c3.2-.3 5.7.2 7.5 1.5 1.8-1.3 4.3-1.8 7.5-1.5V5c-3.2-.3-5.7.2-7.5 1.5z" />
      <path d="M12 6.5V19" />
    </svg>
  );
}

function ExerciseIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="13.5" cy="4.6" r="1.8" />
      <path d="M8 21l3-5.5 3 2.5v3.5M11 15.5l1.5-5 3 2.5 3-1M12.5 10.5l-3-.5-3 2.5" />
    </svg>
  );
}

function MealIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.5 12.5h17a8.5 8.5 0 0 1-17 0z" />
      <path d="M9 9c0-1.5 1-1.5 1-3M13 9c0-1.5 1-1.5 1-3" />
    </svg>
  );
}

function SleepIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />
      <path d="M15 4h3.5L15 8h3.5" />
    </svg>
  );
}

function WalkIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5c-3 0-5 2.6-5 5.6 0 2.7 2.2 4.4 5 4.4s5-1.7 5-4.4c0-3-2-5.6-5-5.6z" />
      <path d="M12 13.5v7M9 20.5h6" />
    </svg>
  );
}

function SwimIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M2.5 16c1.6 0 1.6 1.2 3.2 1.2S7.3 16 8.9 16s1.6 1.2 3.1 1.2S13.6 16 15.2 16s1.6 1.2 3.2 1.2S20 16 21.5 16" />
      <path d="M2.5 20c1.6 0 1.6 1.2 3.2 1.2S7.3 20 8.9 20s1.6 1.2 3.1 1.2S13.6 20 15.2 20s1.6 1.2 3.2 1.2S20 20 21.5 20" />
      <circle cx="16.5" cy="6.5" r="2" />
      <path d="M5 12.5l4.5-3 3 2.5 3-1.5" />
    </svg>
  );
}

function PlayIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="12.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="12.5" width="7" height="7" rx="1.5" />
      <rect x="8.5" y="4" width="7" height="7" rx="1.5" />
    </svg>
  );
}

function CreativeIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.2 0 1.8-.8 1.8-1.7 0-1.2-1-1.6-1-2.6 0-.9.7-1.5 1.6-1.5h2.2a3.9 3.9 0 0 0 3.9-3.9c0-4-3.8-7.3-8.5-7.3z" />
      <circle cx="7.8" cy="11" r="1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function DepartureIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 11.5L12 5l8 6.5" />
      <path d="M6 10v9.5h12V10" />
      <path d="M10 19.5v-4.5h4v4.5" />
    </svg>
  );
}

function OtherIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M12 3.5l2.4 5 5.4.7-4 3.8 1 5.4L12 15.8l-4.8 2.6 1-5.4-4-3.8 5.4-.7z" />
    </svg>
  );
}

export const KIND_META: Record<
  DiaryActivityKind,
  { label: string; tone: Tone; Icon: (props: IconProps) => React.JSX.Element }
> = {
  ARRIVAL: { label: "Kelish", tone: "sun", Icon: ArrivalIcon },
  LESSON: { label: "Mashg'ulot", tone: "lilac", Icon: LessonIcon },
  EXERCISE: { label: "Jismoniy tarbiya", tone: "coral", Icon: ExerciseIcon },
  MEAL: { label: "Ovqatlanish", tone: "sun", Icon: MealIcon },
  SLEEP: { label: "Uyqu", tone: "sky", Icon: SleepIcon },
  WALK: { label: "Sayr", tone: "mint", Icon: WalkIcon },
  SWIM: { label: "Suzish", tone: "sky", Icon: SwimIcon },
  PLAY: { label: "O'yin", tone: "coral", Icon: PlayIcon },
  CREATIVE: { label: "Ijod", tone: "lilac", Icon: CreativeIcon },
  DEPARTURE: { label: "Uyga ketish", tone: "mint", Icon: DepartureIcon },
  OTHER: { label: "Voqea", tone: "sun", Icon: OtherIcon },
};

export function DiaryIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3.5" />
    </svg>
  );
}

export function CameraIcon({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 8.5A2 2 0 0 1 6 6.5h1.6l1.4-2h6l1.4 2H18a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
      <circle cx="12" cy="12.5" r="3.3" />
    </svg>
  );
}

export function PlayGlyph({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M8.5 5.6v12.8a.8.8 0 0 0 1.2.7l10-6.4a.8.8 0 0 0 0-1.4l-10-6.4a.8.8 0 0 0-1.2.7z" fill="currentColor" />
    </svg>
  );
}
