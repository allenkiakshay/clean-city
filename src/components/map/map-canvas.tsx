"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import type { PriorityBucket } from "@/lib/types";

/**
 * Leaflet is client-only, and this file is loaded through a dynamic import with
 * `ssr: false` — see report-map.tsx.
 *
 * CircleMarker rather than Marker on purpose: Leaflet's default marker icons
 * resolve their PNG paths at runtime and break under bundlers, and the usual
 * fix is a pile of icon-path patching. A circle needs no assets, and it lets
 * the priority bucket carry colour, which is the thing an admin scans for.
 */

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  bucket: PriorityBucket;
  status: string;
};

const BUCKET_COLOUR: Record<PriorityBucket, string> = {
  LOW: "#2E7D57",
  MEDIUM: "#A87708",
  HIGH: "#BF5A1C",
  CRITICAL: "#A3302A",
};

function centreOf(points: MapPoint[]): [number, number] {
  if (points.length === 0) return [12.9716, 77.5946]; // Bengaluru
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  return [lat, lng];
}

export default function MapCanvas({
  points,
  selectedId,
  onSelect,
  height = 460,
}: {
  points: MapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
}) {
  return (
    <MapContainer
      center={centreOf(points)}
      zoom={points.length > 1 ? 12 : 14}
      scrollWheelZoom
      style={{ height, width: "100%" }}
      className="rounded-xl border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((point) => {
        const selected = point.id === selectedId;
        return (
          <CircleMarker
            key={point.id}
            center={[point.lat, point.lng]}
            radius={selected ? 12 : 8}
            pathOptions={{
              color: BUCKET_COLOUR[point.bucket],
              fillColor: BUCKET_COLOUR[point.bucket],
              fillOpacity: selected ? 0.9 : 0.55,
              weight: selected ? 3 : 2,
            }}
            eventHandlers={{ click: () => onSelect?.(point.id) }}
          >
            <Popup>
              <strong>{point.label}</strong>
              <br />
              {point.bucket} &middot; {point.status.toLowerCase()}
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
