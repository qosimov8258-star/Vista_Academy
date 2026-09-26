import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { WhyUs } from "@/components/why-us";
import { Stats } from "@/components/stats";
import { Programs } from "@/components/programs";
import { DirectorQuote } from "@/components/director-quote";
import { Adaptation } from "@/components/adaptation";
import { OurGroups } from "@/components/our-groups";
import { Testimonials } from "@/components/testimonials";
import { Footer } from "@/components/footer";
import { fetchLanding } from "@/lib/api";
import { PLACEHOLDER_GROUPS, toDisplayGroups } from "@/lib/groups";
import type { LandingGroup } from "@/lib/types";

export default async function HomePage() {
  const fetchedGroups = await fetchLanding<LandingGroup[]>("/groups", []);
  const groups = fetchedGroups.length > 0 ? toDisplayGroups(fetchedGroups) : PLACEHOLDER_GROUPS;

  return (
    <main>
      <SiteHeader />
      <Hero />
      <Stats />
      <WhyUs />
      <Programs />
      <DirectorQuote />
      <Adaptation />
      <OurGroups groups={groups} />
      <Testimonials />
      <Footer />
    </main>
  );
}
