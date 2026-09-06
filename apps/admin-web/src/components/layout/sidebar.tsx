"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import clsx from "clsx";
import { useAuth } from "@/lib/use-auth";
import { useBranchContext } from "@/lib/use-branch-context";

const ROLE_LABEL = { NETWORK_ADMIN: "Tarmoq Admin", BRANCH_ADMIN: "Filial Menejeri", MANAGER: "Administrator" } as const;

export function Sidebar({ slug }: { slug: string }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const isNetworkAdmin = user?.role === "NETWORK_ADMIN";
  const canManageUsers = user?.role === "NETWORK_ADMIN" || user?.role === "BRANCH_ADMIN";
  const params = useParams<{ branchSlug?: string }>();
  const { branch } = useBranchContext(slug);
  // A NETWORK_ADMIN who hasn't drilled into a specific branch only manages
  // the network itself (home overview + branch list) — every operational
  // module (children, finance, attendance, ...) only makes sense once a
  // branch is selected, so it's hidden from them until then.
  const inBranchContext = isNetworkAdmin && !!params?.branchSlug;
  const base = inBranchContext ? `/${slug}/${params.branchSlug}` : `/${slug}`;

  const rootNavItems = [
    { href: `/${slug}`, label: "Bosh sahifa", icon: "📊", show: true, exact: true },
    { href: `/${slug}/branches`, label: "Filiallar", icon: "🏫", show: true },
  ];

  const operationalNavItems = [
    { href: base, label: "Bosh sahifa", icon: "📊", show: true, exact: true },
    { href: `${base}/crm`, label: "Arizalar (CRM)", icon: "📞", show: true },
    { href: `${base}/children`, label: "Bolalar", icon: "🧒", show: true },
    { href: `${base}/groups`, label: "Guruhlar", icon: "👥", show: true },
    { href: `${base}/employees`, label: "Xodimlar", icon: "🧑‍🏫", show: true },
    { href: `${base}/hr`, label: "Ish haqi (HR)", icon: "💼", show: true },
    { href: `${base}/attendance`, label: "Davomat", icon: "📋", show: true },
    { href: `${base}/daily-reports`, label: "Kundalik hisobot", icon: "📝", show: true },
    { href: `${base}/staff-attendance`, label: "Xodimlar davomati", icon: "🗓️", show: true },
    { href: `${base}/nutrition`, label: "Ovqatlanish", icon: "🍽️", show: true },
    { href: `${base}/finance`, label: "Moliya", icon: "💵", show: true },
    { href: `${base}/notifications`, label: "Bildirishnomalar", icon: "🔔", show: true },
    // Branch/user management stay a network-wide (root-level) concern, never
    // duplicated inside a single branch's panel.
    { href: `/${slug}/users`, label: "Foydalanuvchilar", icon: "🔑", show: canManageUsers && !inBranchContext },
  ];

  const navItems = (isNetworkAdmin && !inBranchContext ? rootNavItems : operationalNavItems).filter((item) => item.show);

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] md:flex">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-primary)] text-sm font-bold text-white">
          B
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-[var(--color-text)]">
            {user ? ROLE_LABEL[user.role] : "Admin"}
          </p>
          {user?.branchName && (
            <p className="truncate text-xs leading-tight text-[var(--color-text-muted)]">{user.branchName}</p>
          )}
        </div>
      </div>

      {inBranchContext && (
        <div className="border-b border-[var(--color-border)] px-3 py-3">
          <Link
            href={`/${slug}/branches`}
            className="flex items-center gap-1 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            ← Filiallar
          </Link>
          <p className="mt-1 truncate text-sm font-semibold text-[var(--color-text)]">{branch?.name ?? "..."}</p>
        </div>
      )}

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = "exact" in item && item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[var(--color-primary)]/10 text-[var(--color-primary)]"
                  : "text-[var(--color-text-muted)] hover:bg-gray-50 hover:text-[var(--color-text)]",
              )}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
