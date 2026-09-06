"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "./api";
import type { Organization } from "./types";

/**
 * When a NETWORK_ADMIN has drilled into one branch's panel, the URL carries
 * an extra `branchSlug` segment (see app/(dashboard)/[slug]/[branchSlug]/**,
 * which re-exports the same page components used at the org-root level).
 * Every list/detail page reads this hook to find out whether it should force
 * all of its data to one branch instead of showing the whole network.
 * Absent for BRANCH_ADMIN/MANAGER (their scope is already fixed server-side)
 * and for NETWORK_ADMIN at the org root (no branchSlug in the URL there).
 */
export function useBranchContext(slug: string) {
  const params = useParams<{ branchSlug?: string }>();
  const branchSlug = params?.branchSlug;

  const orgQuery = useQuery({
    queryKey: ["org", slug],
    queryFn: () => api.get<Organization>("/app/organizations/me"),
  });

  const branch = branchSlug ? (orgQuery.data?.branches.find((b) => b.slug === branchSlug) ?? null) : null;

  return {
    branchSlug: branchSlug ?? null,
    branch,
    branchId: branch?.id ?? null,
    branches: orgQuery.data?.branches ?? [],
  };
}
