"use client";

import { useState } from "react";
import type { Id } from "@/convex/_generated/dataModel";
import { SeriesCodexTab } from "./codex-tab";
import { SeriesArcsTab } from "./arcs-tab";
import { SeriesTimelineTab } from "./timeline-tab";
import { BoxedSetTab } from "./boxed-set-tab";

const TABS = [
  { key: "codex", label: "Codex" },
  { key: "arcs", label: "Arcs & beats" },
  { key: "timeline", label: "Timeline" },
  { key: "boxed", label: "Boxed set" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function SeriesTabs({ seriesId }: { seriesId: Id<"series"> }) {
  const [active, setActive] = useState<TabKey>("codex");
  return (
    <div className="space-y-4">
      <nav className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActive(t.key)}
            className={`rounded-t-md border-b-2 px-3 py-1.5 text-sm transition-colors ${
              active === t.key
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>
      {active === "codex" && <SeriesCodexTab seriesId={seriesId} />}
      {active === "arcs" && <SeriesArcsTab seriesId={seriesId} />}
      {active === "timeline" && <SeriesTimelineTab seriesId={seriesId} />}
      {active === "boxed" && <BoxedSetTab seriesId={seriesId} />}
    </div>
  );
}
