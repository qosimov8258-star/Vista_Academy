import type { Metadata } from "next";
import Image from "next/image";
import { ApplicationForm } from "@/components/application-form";
import { BackButton } from "@/components/back-button";

export const metadata: Metadata = {
  title: "Ariza qoldirish — Vista Academy",
};

export default function ApplicationPage() {
  return (
    <main className="relative z-0 flex min-h-dvh flex-col overflow-hidden px-6 pt-8 pb-32">
      <Image
        src="/ariza.jpeg"
        alt=""
        fill
        priority
        aria-hidden="true"
        className="-z-10 object-cover"
      />
      <ApplicationForm />
      <BackButton />
    </main>
  );
}
