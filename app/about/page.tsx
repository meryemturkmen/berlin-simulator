import type { Metadata } from "next";
import { AboutContent } from "@/components/about/AboutContent";

export const metadata: Metadata = {
  title: "About · Berlin Simulator",
  description:
    "How Berlin Simulator is built: open geodata, a procedural asset pipeline, LLM-driven NPCs, and the tech stack behind it.",
};

export default function AboutPage() {
  return <AboutContent />;
}
