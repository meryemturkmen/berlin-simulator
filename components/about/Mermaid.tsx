"use client";

import { useEffect, useId, useState } from "react";

/**
 * Renders a Mermaid diagram. The library is loaded on demand, only on pages
 * that show a diagram; until then (and without JavaScript) the source is shown.
 */
export function Mermaid({ chart, label }: { chart: string; label: string }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("mermaid").then(async ({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        fontFamily: "inherit",
        themeVariables: {
          primaryColor: "#fdf6e9",
          primaryBorderColor: "#211c2e",
          primaryTextColor: "#211c2e",
          lineColor: "#4a4458",
          secondaryColor: "#f3d9b8",
          tertiaryColor: "#f7f0e3",
        },
      });
      try {
        const result = await mermaid.render(`diagram-${id}`, chart);
        if (!cancelled) setSvg(result.svg);
      } catch {
        // Keep the text fallback.
      }
    });
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (svg) {
    return (
      <div
        role="img"
        aria-label={label}
        data-testid="architecture-diagram"
        className="overflow-x-auto [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
    );
  }
  return (
    <pre aria-label={label} className="text-ink-soft overflow-x-auto text-sm leading-relaxed">
      {chart}
    </pre>
  );
}
