"use client";

import { use } from "react";
import { ParentDetail } from "@/features/parents/parent-detail";

export default function ParentDetailRoute({ params }: { params: Promise<{ slug: string; guardianId: string }> }) {
  const { slug, guardianId } = use(params);
  return <ParentDetail slug={slug} guardianId={guardianId} />;
}
