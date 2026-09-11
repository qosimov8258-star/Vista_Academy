import { redirect } from "next/navigation";

export default async function LessonsHubPage({
  params,
}: {
  params: Promise<{ slug: string; branchSlug?: string }>;
}) {
  const { slug, branchSlug } = await params;
  redirect(branchSlug ? `/${slug}/${branchSlug}/lessons/schedule` : `/${slug}/lessons/schedule`);
}
