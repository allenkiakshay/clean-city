"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type {
  HeatPoint,
  MapBin,
  MapReport,
} from "@/components/map/public-map-canvas";

const PublicMapCanvas = dynamic(
  () => import("@/components/map/public-map-canvas"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[70vh] min-h-[420px] items-center justify-center rounded-xl border text-sm text-muted-foreground">
        Loading map…
      </div>
    ),
  },
);

const LEGEND: { label: string; colour: string }[] = [
  { label: "Low", colour: "#2E7D57" },
  { label: "Medium", colour: "#A87708" },
  { label: "High", colour: "#BF5A1C" },
  { label: "Critical", colour: "#A3302A" },
];

export function MapView({
  reports,
  bins,
  heat,
}: {
  reports: MapReport[];
  bins: MapBin[];
  heat: HeatPoint[];
}) {
  const [showReports, setShowReports] = useState(true);
  const [showBins, setShowBins] = useState(true);
  const [showHeat, setShowHeat] = useState(false);

  const toggles: [string, boolean, (v: boolean) => void, string][] = [
    ["Open reports", showReports, setShowReports, `${reports.length}`],
    ["Bins", showBins, setShowBins, `${bins.length}`],
    ["Heatmap", showHeat, setShowHeat, `${heat.length} cells`],
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {toggles.map(([label, on, set, count]) => (
          <button
            key={label}
            type="button"
            onClick={() => set(!on)}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              on ? "border-foreground" : "border-input text-muted-foreground"
            }`}
          >
            {label}{" "}
            <span className="text-xs text-muted-foreground tabular-nums">
              {count}
            </span>
          </button>
        ))}

        <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: item.colour }}
              />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      <PublicMapCanvas
        reports={reports}
        bins={bins}
        heat={heat}
        showReports={showReports}
        showBins={showBins}
        showHeat={showHeat}
      />

      <p className="text-xs text-muted-foreground">
        Circle colour is the priority bucket. Bins are drawn with a dashed
        outline until the sensor feed is switched on — the schema and endpoints
        are already in place.
      </p>
    </div>
  );
}
