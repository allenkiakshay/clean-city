"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/components/map/map-canvas";

/**
 * `ssr: false` is illegal inside a Server Component in Next 16, so this wrapper
 * is a Client Component whose only job is to hold the dynamic import. Leaflet
 * touches `window` at module scope and cannot be server-rendered at all.
 */
const MapCanvas = dynamic(() => import("@/components/map/map-canvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[460px] items-center justify-center rounded-xl border text-sm text-muted-foreground">
      Loading map…
    </div>
  ),
});

export type { MapPoint };

export function ReportMap(props: {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
}) {
  return <MapCanvas {...props} />;
}
