import type { Metadata } from "next";
import { AvatarEditor } from "@/components/editor/AvatarEditor";

export const metadata: Metadata = { title: "Avatar · Berlin Simulator" };

export default function AvatarPage() {
  return <AvatarEditor />;
}
