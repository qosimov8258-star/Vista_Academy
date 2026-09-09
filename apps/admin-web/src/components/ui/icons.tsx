import type { SVGProps } from "react";

/**
 * Qo'lda chizilgan ikonkalar to'plami. Kutubxona olinmagan: bu yerda
 * hammasi `currentColor` bilan ishlaydi va bitta o'lchov to'riga bo'ysunadi.
 *
 * Ikki xil chizilishi bor:
 *   • kontur (sukut) — tinch holat;
 *   • to'ldirilgan (`filled`) — yon paneldagi faol bo'lim uchun. iOS da
 *     tanlangan bo'lim aynan shu tarzda ajratiladi, rang bilan emas.
 *
 * Qoidalar: 24×24 to'r, chiziq qalinligi 1.6, uchlari va burchaklari
 * yumaloq, barcha shakl 2.5–21.5 oralig'ida (optik chekka).
 */
export type IconProps = SVGProps<SVGSVGElement> & { filled?: boolean };

function Outline({ children, filled: _filled, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

function Solid({ children, filled: _filled, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      stroke="none"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Yon panel ikonkalari — konturi ham, to'ldirilgani ham bor           */
/* ------------------------------------------------------------------ */

export function HomeIcon({ filled, ...props }: IconProps) {
  if (filled) {
    return (
      <Solid {...props}>
        <path d="M11.05 3.2a1.5 1.5 0 0 1 1.9 0l7.3 5.98c.35.29.55.72.55 1.17v8.4a2.25 2.25 0 0 1-2.25 2.25H15.5a.75.75 0 0 1-.75-.75v-4.5a2.75 2.75 0 0 0-5.5 0v4.5a.75.75 0 0 1-.75.75H5.45A2.25 2.25 0 0 1 3.2 18.75v-8.4c0-.45.2-.88.55-1.17Z" />
      </Solid>
    );
  }
  return (
    <Outline {...props}>
      <path d="M3.6 10.2 12 3.5l8.4 6.7" />
      <path d="M5.5 9.2v9.4a1.9 1.9 0 0 0 1.9 1.9h2.4v-4.7a2.2 2.2 0 0 1 4.4 0v4.7h2.4a1.9 1.9 0 0 0 1.9-1.9V9.2" />
    </Outline>
  );
}

export function BuildingIcon({ filled, ...props }: IconProps) {
  if (filled) {
    return (
      <Solid {...props}>
        <path d="M12.53 3.06a1.25 1.25 0 0 0-1.06 0l-6 2.7A1.75 1.75 0 0 0 4.5 7.36V20.5h4.25v-3.25a3.25 3.25 0 0 1 6.5 0v3.25h4.25V7.36c0-.69-.4-1.32-1.03-1.6ZM9 10.75a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2ZM9 14.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm6 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z" />
        <path d="M3 20.5h18a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1 0-1.5Z" />
      </Solid>
    );
  }
  return (
    <Outline {...props}>
      <path d="M3.5 20.5h17" />
      <path d="M5.5 20.5V7.6a1.6 1.6 0 0 1 .95-1.46l5-2.25a1.6 1.6 0 0 1 1.3 0l5 2.25a1.6 1.6 0 0 1 .95 1.46V20.5" />
      <path d="M9.5 9.6h.01M14.5 9.6h.01M9.5 13.4h.01M14.5 13.4h.01" />
      <path d="M9.75 20.5v-3.15a2.25 2.25 0 0 1 4.5 0v3.15" />
    </Outline>
  );
}

export function ChildIcon({ filled, ...props }: IconProps) {
  if (filled) {
    return (
      <Solid {...props}>
        <circle cx="6.6" cy="6.4" r="1.9" />
        <circle cx="17.4" cy="6.4" r="1.9" />
        <path d="M12 3.4a5.4 5.4 0 1 0 0 10.8 5.4 5.4 0 0 0 0-10.8Zm-2.1 5.2a.85.85 0 1 1 1.7 0 .85.85 0 0 1-1.7 0Zm4.5 0a.85.85 0 1 1-1.7 0 .85.85 0 0 1 1.7 0Z" />
        <path d="M12 15.1c-3.2 0-5.8 2.35-5.8 5.25 0 .63.5 1.15 1.13 1.15h9.34c.62 0 1.13-.52 1.13-1.15 0-2.9-2.6-5.25-5.8-5.25Z" />
      </Solid>
    );
  }
  return (
    <Outline {...props}>
      <circle cx="12" cy="8.6" r="4.6" />
      <circle cx="6.4" cy="5.4" r="1.7" />
      <circle cx="17.6" cy="5.4" r="1.7" />
      <path d="M10.4 8.4h.01M13.6 8.4h.01" />
      <path d="M10.5 11.1a2.2 2.2 0 0 0 3 0" />
      <path d="M6.6 20.9v-1.1a5.4 5.4 0 0 1 10.8 0v1.1" />
    </Outline>
  );
}

export function GroupIcon({ filled, ...props }: IconProps) {
  if (filled) {
    return (
      <Solid {...props}>
        <circle cx="9" cy="8" r="3.4" />
        <path d="M9 12.9c-3.1 0-5.6 2.1-5.6 4.75 0 .8.65 1.45 1.45 1.45h8.3c.8 0 1.45-.65 1.45-1.45 0-2.65-2.5-4.75-5.6-4.75Z" />
        <path d="M16.6 6.1a2.85 2.85 0 1 1 0 5.7 2.85 2.85 0 0 1 0-5.7Z" opacity=".55" />
        <path d="M17.1 13.3c-.6 0-1.17.07-1.7.2a6.8 6.8 0 0 1 1.9 4.6h3.05c.75 0 1.35-.6 1.35-1.35 0-1.95-2.06-3.45-4.6-3.45Z" opacity=".55" />
      </Solid>
    );
  }
  return (
    <Outline {...props}>
      <circle cx="9.2" cy="8.2" r="3.1" />
      <path d="M3.6 20v-.9a5.6 5.6 0 0 1 11.2 0v.9" />
      <path d="M16.2 5.6a3.1 3.1 0 0 1 0 5.9" />
      <path d="M17.8 14.9a4.6 4.6 0 0 1 2.6 4.2v.9" />
    </Outline>
  );
}

export function TeacherIcon({ filled, ...props }: IconProps) {
  if (filled) {
    return (
      <Solid {...props}>
        <path d="M15.25 3.5h-6.5A1.25 1.25 0 0 0 7.5 4.75V6H6.25A2.75 2.75 0 0 0 3.5 8.75v9A2.75 2.75 0 0 0 6.25 20.5h11.5a2.75 2.75 0 0 0 2.75-2.75v-9A2.75 2.75 0 0 0 17.75 6H16.5V4.75a1.25 1.25 0 0 0-1.25-1.25ZM9 5h6v1H9Zm3 5.1a2.15 2.15 0 1 1 0 4.3 2.15 2.15 0 0 1 0-4.3Zm0 5.3c1.9 0 3.5 1.14 3.5 2.55 0 .3-.25.55-.55.55h-5.9a.55.55 0 0 1-.55-.55c0-1.41 1.6-2.55 3.5-2.55Z" />
      </Solid>
    );
  }
  return (
    <Outline {...props}>
      <rect x="3.6" y="6" width="16.8" height="14.5" rx="3" />
      <path d="M9 6V4.6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V6" />
      <circle cx="12" cy="12.2" r="2.2" />
      <path d="M8.6 17.9a3.6 3.6 0 0 1 6.8 0" />
    </Outline>
  );
}

export function MoneyIcon({ filled, ...props }: IconProps) {
  if (filled) {
    return (
      <Solid {...props}>
        <path d="M4.75 5.5h14.5A2.75 2.75 0 0 1 22 8.25v7.5A2.75 2.75 0 0 1 19.25 18.5H4.75A2.75 2.75 0 0 1 2 15.75v-7.5A2.75 2.75 0 0 1 4.75 5.5Zm7.25 3.9a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2ZM5.75 9.4a.75.75 0 0 0-.75.75v3.7a.75.75 0 0 0 1.5 0v-3.7a.75.75 0 0 0-.75-.75Zm12.5 0a.75.75 0 0 0-.75.75v3.7a.75.75 0 0 0 1.5 0v-3.7a.75.75 0 0 0-.75-.75Z" />
      </Solid>
    );
  }
  return (
    <Outline {...props}>
      <rect x="2.6" y="6" width="18.8" height="12" rx="3" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 10.2v3.6M18 10.2v3.6" />
    </Outline>
  );
}

export function BellIcon({ filled, ...props }: IconProps) {
  if (filled) {
    return (
      <Solid {...props}>
        <path d="M12 2.6a6.4 6.4 0 0 0-6.4 6.4v4.02l-1.3 2.17A1.25 1.25 0 0 0 5.37 17.1h13.26a1.25 1.25 0 0 0 1.07-1.91l-1.3-2.17V9A6.4 6.4 0 0 0 12 2.6Z" />
        <path d="M9.6 18.6a2.55 2.55 0 0 0 4.8 0Z" />
      </Solid>
    );
  }
  return (
    <Outline {...props}>
      <path d="M18.2 14.6V9a6.2 6.2 0 1 0-12.4 0v5.6l-1.3 2.2h15Z" />
      <path d="M9.8 19.2a2.4 2.4 0 0 0 4.4 0" />
    </Outline>
  );
}

export function SettingsIcon({ filled, ...props }: IconProps) {
  // 6 tishli sodda tishli g'ildirak: Feather'ning 12 tishlisi 18px da loyqa chiqadi
  const gear =
    "M12 2.6c-.62 0-1.17.4-1.36.99l-.3.93a7.6 7.6 0 0 0-1.3.75l-.95-.24a1.43 1.43 0 0 0-1.58.65l-.9 1.56a1.43 1.43 0 0 0 .22 1.7l.68.7a7.7 7.7 0 0 0 0 1.5l-.68.7a1.43 1.43 0 0 0-.22 1.7l.9 1.56c.31.54.95.8 1.58.65l.95-.24c.4.3.84.55 1.3.75l.3.93c.19.6.74.99 1.36.99h1.8c.62 0 1.17-.4 1.36-.99l.3-.93c.46-.2.9-.45 1.3-.75l.95.24c.63.16 1.27-.11 1.58-.65l.9-1.56a1.43 1.43 0 0 0-.22-1.7l-.68-.7a7.7 7.7 0 0 0 0-1.5l.68-.7a1.43 1.43 0 0 0 .22-1.7l-.9-1.56a1.43 1.43 0 0 0-1.58-.65l-.95.24a7.6 7.6 0 0 0-1.3-.75l-.3-.93A1.43 1.43 0 0 0 13.8 2.6Z";
  if (filled) {
    return (
      <Solid {...props}>
        <path fillRule="evenodd" clipRule="evenodd" d={`${gear} M12.9 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z`} />
      </Solid>
    );
  }
  return (
    <Outline {...props}>
      <path d={gear} />
      <circle cx="12.9" cy="12" r="2.9" />
    </Outline>
  );
}

export function ChartIcon({ filled, ...props }: IconProps) {
  if (filled) {
    return (
      <Solid {...props}>
        <rect x="3" y="12.5" width="3.6" height="7" rx="1.4" />
        <rect x="10.2" y="4.5" width="3.6" height="15" rx="1.4" />
        <rect x="17.4" y="9" width="3.6" height="10.5" rx="1.4" />
        <path d="M3 20.5h18a.75.75 0 0 1 0 1.5H3a.75.75 0 0 1 0-1.5Z" />
      </Solid>
    );
  }
  return (
    <Outline {...props}>
      <rect x="3.2" y="12.6" width="3.4" height="6.9" rx="1.3" />
      <rect x="10.3" y="4.6" width="3.4" height="14.9" rx="1.3" />
      <rect x="17.4" y="9.1" width="3.4" height="10.4" rx="1.3" />
      <path d="M3 21h18" />
    </Outline>
  );
}

/* ------------------------------------------------------------------ */
/* Bo'lim ikonkalari (faqat kontur)                                    */
/* ------------------------------------------------------------------ */

export function PhoneIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M6.6 3.5h2.7a1.2 1.2 0 0 1 1.13.79l1.06 2.9a1.2 1.2 0 0 1-.4 1.36l-1.4 1.06a11.6 11.6 0 0 0 4.7 4.7l1.06-1.4a1.2 1.2 0 0 1 1.36-.4l2.9 1.06a1.2 1.2 0 0 1 .79 1.13v2.7a2 2 0 0 1-2.2 2A16.6 16.6 0 0 1 3.53 5.7a2 2 0 0 1 2-2.2Z" />
    </Outline>
  );
}

export function BriefcaseIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="3" y="7.4" width="18" height="12.6" rx="3" />
      <path d="M9 7.4V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.4" />
      <path d="M3 12.8h18" />
      <path d="M10.6 12.8h2.8" />
    </Outline>
  );
}

export function ChecklistIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="4" y="4.4" width="16" height="16.1" rx="3" />
      <path d="M9 3.4h6a1 1 0 0 1 1 1v1.2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V4.4a1 1 0 0 1 1-1Z" />
      <path d="m8.8 12 1.6 1.6 3.2-3.2" />
      <path d="M8.8 17h6.4" />
    </Outline>
  );
}

export function NoteIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M5.5 3.5h7.3L19 9.6v9.4a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2V5.5a2 2 0 0 1 2-2Z" />
      <path d="M12.6 3.6v4.4a1.6 1.6 0 0 0 1.6 1.6h4.4" />
      <path d="M7.6 13.4h7M7.6 17h4.6" />
    </Outline>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="3.4" y="5.2" width="17.2" height="15.4" rx="3" />
      <path d="M3.4 10h17.2" />
      <path d="M8.2 3.4v3.4M15.8 3.4v3.4" />
      <path d="M7.8 13.6h1.6M11.2 13.6h1.6M14.6 13.6h1.6M7.8 17h1.6M11.2 17h1.6" />
    </Outline>
  );
}

export function MealIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M6.2 3.4v6.2a2.6 2.6 0 0 0 5.2 0V3.4" />
      <path d="M8.8 3.4v6" />
      <path d="M8.8 12.2v8.4" />
      <path d="M17.6 3.4c-1.5 1.5-2.2 3.2-2.2 5.4 0 1.8.73 2.9 2.2 3.4v8.4" />
    </Outline>
  );
}

export function KeyIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <circle cx="8.2" cy="15.4" r="3.9" />
      <path d="m11.1 12.6 8.3-8.3" />
      <path d="m16.4 6 2.1 2.1" />
      <path d="m13.9 8.5 2.1 2.1" />
    </Outline>
  );
}

export function SidebarIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="3.2" y="4.4" width="17.6" height="15.2" rx="3" />
      <path d="M9.6 4.4v15.2" />
    </Outline>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <circle cx="11" cy="11" r="6.8" />
      <path d="m16.1 16.1 4.3 4.3" />
    </Outline>
  );
}

/* ------------------------------------------------------------------ */
/* Amal ikonkalari                                                     */
/* ------------------------------------------------------------------ */

export function ArrowLeftIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M19.4 12H4.6" />
      <path d="m10.8 5.8-6.2 6.2 6.2 6.2" />
    </Outline>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="m9.5 5.5 6.5 6.5-6.5 6.5" />
    </Outline>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="m5.5 9.5 6.5 6.5 6.5-6.5" />
    </Outline>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M17.6 6.4 6.4 17.6M6.4 6.4l11.2 11.2" />
    </Outline>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M12 5.4v13.2M5.4 12h13.2" />
    </Outline>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="m5 12.6 4.6 4.6L19 7.4" />
    </Outline>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M4.5 16.4 15.8 5.1a2.4 2.4 0 0 1 3.4 3.4L7.9 19.8l-4.4 1 1-4.4Z" />
      <path d="m14.4 6.5 3.4 3.4" />
    </Outline>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M4.6 6.6h14.8" />
      <path d="M9.4 6.6V5.2a1.6 1.6 0 0 1 1.6-1.6h2a1.6 1.6 0 0 1 1.6 1.6v1.4" />
      <path d="M6.6 6.6v12a2.4 2.4 0 0 0 2.4 2.4h6a2.4 2.4 0 0 0 2.4-2.4v-12" />
      <path d="M10.4 10.6v6M13.6 10.6v6" />
    </Outline>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="4.6" y="10.4" width="14.8" height="10.2" rx="3" />
      <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.6 0v2.6" />
      <path d="M12 14.6v2" />
    </Outline>
  );
}

export function UnlockIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="4.6" y="10.4" width="14.8" height="10.2" rx="3" />
      <path d="M8.2 10.4V7.8a3.8 3.8 0 0 1 7.4-1.1" />
      <path d="M12 14.6v2" />
    </Outline>
  );
}

export function CopyIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <rect x="8.6" y="8.6" width="11.8" height="11.8" rx="3" />
      <path d="M15.4 8.6V6.2a2.6 2.6 0 0 0-2.6-2.6H6.2a2.6 2.6 0 0 0-2.6 2.6v6.6a2.6 2.6 0 0 0 2.6 2.6h2.4" />
    </Outline>
  );
}

export function AlertIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M10.36 4.3 2.9 17.2a1.9 1.9 0 0 0 1.64 2.85h14.92a1.9 1.9 0 0 0 1.64-2.85L13.64 4.3a1.9 1.9 0 0 0-3.28 0Z" />
      <path d="M12 9.4v4.2M12 17h.01" />
    </Outline>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 11.4v5" />
      <path d="M12 8.2h.01" />
    </Outline>
  );
}

export function WalletIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <path d="M3.4 8.6a3 3 0 0 1 3-3h11.2a3 3 0 0 1 3 3v8.8a3 3 0 0 1-3 3H6.4a3 3 0 0 1-3-3Z" />
      <path d="M20.6 11.4h-3.4a2.2 2.2 0 0 0 0 4.4h3.4" />
      <path d="M3.4 9.4V7.2a2 2 0 0 1 1.5-1.94l9.3-2.2" />
    </Outline>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Outline {...props}>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 7.4V12l3.1 1.9" />
    </Outline>
  );
}
