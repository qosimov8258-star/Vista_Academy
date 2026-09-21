import { SiteHeader } from "@/components/site-header";
import { Hero } from "@/components/hero";
import { WhyUs } from "@/components/why-us";
import { Programs } from "@/components/programs";
import { Adaptation } from "@/components/adaptation";
import { OurGroups } from "@/components/our-groups";
import { Testimonials } from "@/components/testimonials";
import { Footer } from "@/components/footer";

export default function HomePage() {
  return (
    <main>
      <SiteHeader />
      <Hero />
      <WhyUs />
      <Programs />
      <Adaptation />
      <OurGroups />
      <Testimonials />
      <Footer />
    </main>
  );
}
