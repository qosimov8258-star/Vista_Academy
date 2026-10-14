"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { FeatureDefinition } from "@/lib/types";

export function useFeatureCatalog() {
  return useQuery({
    queryKey: ["feature-catalog"],
    queryFn: () => api.get<FeatureDefinition[]>("/platform/features"),
    staleTime: 5 * 60 * 1000,
  });
}

/** Funksiyalarni guruh bo'yicha ajratadi (katalog tartibi saqlanadi). */
export function groupFeatures(catalog: FeatureDefinition[]): [string, FeatureDefinition[]][] {
  const groups = new Map<string, FeatureDefinition[]>();
  for (const feature of catalog) {
    groups.set(feature.group, [...(groups.get(feature.group) ?? []), feature]);
  }
  return [...groups.entries()];
}
