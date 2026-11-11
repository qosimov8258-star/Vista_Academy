"use client";

import { PhoneIcon } from "./icons";
import { useTr } from "@/i18n/tr";

/** Qatordagi qo'ng'iroq tugmasi — yashil doira (44px bosish joyi) */
export function CallButton({ phone, name }: { phone: string; name: string }) {
  const tr = useTr();
  return (
    <a
      href={`tel:${phone}`}
      onClick={(event) => event.stopPropagation()}
      aria-label={tr("{0} ga qo'ng'iroq: {1}", name, phone)}
      title={phone}
      className="flex h-11 w-11 items-center justify-center rounded-full transition-transform active:scale-90"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#34c759]/[0.14] text-[#34c759]">
        <PhoneIcon className="h-[17px] w-[17px]" strokeWidth={2.2} />
      </span>
    </a>
  );
}
