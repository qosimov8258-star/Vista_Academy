import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 text-center">
          <h1 className="flex justify-center">
            {/* Rasmiy logotip (public/zeeron-logo.svg — harflar atrofi qirqilgan) */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/zeeron-logo.svg" alt="Zeeron" width={176} height={41} className="h-[41px] w-auto" />
          </h1>
          <p className="mt-2.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-subtle)]">Platforma</p>
          <p className="mt-4 text-[14px] text-[var(--color-text-muted)]">Bog&apos;chalarni boshqarish paneliga kirish</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
