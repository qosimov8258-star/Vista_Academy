import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4 py-10">
      <div className="w-full max-w-[380px]">
        <div className="mb-7 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-[var(--color-primary)] text-[22px] font-bold text-white shadow-[var(--shadow-raised)]">
            B
          </div>
          <h1 className="text-[20px] font-semibold text-[var(--color-text)]">Platform Super Admin</h1>
          <p className="mt-1 text-[13px] text-[var(--color-text-muted)]">
            Bog&apos;chalar tarmog&apos;i SaaS boshqaruvi
          </p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
