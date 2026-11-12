"use client";

import { use } from "react";
import { BroadcastsPage } from "@/features/broadcasts/broadcasts-page";

export default function MessagesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return <BroadcastsPage slug={slug} />;
}
