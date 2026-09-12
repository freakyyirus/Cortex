import { MotionConfig } from "framer-motion";

import CarbonHero from "./components/CarbonHero";
import Stats from "./components/Stats";
import CarbonFeatures from "./components/CarbonFeatures";
import SplitShowcase from "./components/SplitShowcase";
import Timeline from "./components/Timeline";
import InfraStrip from "./components/InfraStrip";
import CtaBanner from "./components/CtaBanner";
import FaqAccordion from "./components/FaqAccordion";

export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex min-h-screen flex-col overflow-x-hidden">
        <CarbonHero />
        <Stats />
        <CarbonFeatures />
        <SplitShowcase />
        <Timeline />
        <InfraStrip />
        <CtaBanner />
        <FaqAccordion />
      </div>
    </MotionConfig>
  );
}