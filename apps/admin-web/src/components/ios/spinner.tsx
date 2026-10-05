import clsx from "clsx";
import styles from "./ios.module.css";

/** iOS faollik ko'rsatkichi — 8 ta tig', navbat bilan xiralashadi */
export function Spinner({ className, label = "Yuklanmoqda" }: { className?: string; label?: string }) {
  return (
    <span role="status" aria-label={label} className={clsx(styles.spinner, "relative inline-block h-5 w-5 shrink-0", className)}>
      {Array.from({ length: 8 }, (_, i) => (
        <span
          key={i}
          className="absolute left-[44%] top-0 h-[28%] w-[12%] rounded-full bg-current"
          style={{ transform: `rotate(${i * 45}deg)`, transformOrigin: "50% 179%", animationDelay: `${(i - 8) * 0.1}s` }}
        />
      ))}
    </span>
  );
}
