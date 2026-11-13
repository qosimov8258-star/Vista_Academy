"use client";

import { use } from "react";
import { ParentsPage } from "@/features/parents/parents-page";

export default function ParentsRoute({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <ParentsPage slug={slug} />;
}
