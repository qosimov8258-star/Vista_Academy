import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg)] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)] text-xl font-bold text-white">
            B
          </div>
          <h1 className="text-lg font-semibold text-[var(--color-text)]">Platform Super Admin</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Bog'chalar tarmog'i SaaS boshqaruvi</p>
        </div>

        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
