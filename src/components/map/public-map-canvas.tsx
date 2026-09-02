"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import { HeatLayer } from "@/components/map/heat-layer";
import type { PriorityBucket } from "@/lib/types";

export type MapReport = {
  id: string;
  lat: number;
  lng: number;
  category: string;
  status: string;
  bucket: PriorityBucket;
};

export type MapBin = {
  id: string;
  code: string;
  label: string;
  lat: number;
  lng: number;
  fillPercent: number | null;
};

export type HeatPoint = { lat: number; lng: number; weight: number };

const BUCKET_COLOUR: Record<PriorityBucket, string> = {
  LOW: "#2E7D57",
  MEDIUM: "#A87708",
  HIGH: "#BF5A1C",
  CRITICAL: "#A3302A",
};

/** Bins use the same four-stop scale as priority — one visual language. */
function fillColour(fill: number | null): string {
  if (fill === null) return "#8B968F";
  if (fill >= 90) return "#A3302A";
  if (fill >= 70) return "#BF5A1C";
  if (fill >= 40) return "#A87708";
  return "#2E7D57";
}

export default function PublicMapCanvas({
  reports,
  bins,
  heat,
  showReports,
  showBins,
  showHeat,
}: {
  reports: MapReport[];
  bins: MapBin[];
  heat: HeatPoint[];
  showReports: boolean;
  showBins: boolean;
  showHeat: boolean;
}) {
  const all = [...reports, ...bins];
  const centre: [number, number] =
    all.length > 0
      ? [
          all.reduce((sum, p) => sum + p.lat, 0) / all.length,
          all.reduce((sum, p) => sum + p.lng, 0) / all.length,
        ]
      : [12.9716, 77.5946];

  return (
    <MapContainer
      center={centre}
      zoom={12}
      scrollWheelZoom
      style={{ height: "70vh", minHeight: 420, width: "100%" }}
      className="rounded-xl border"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <HeatLayer points={heat} visible={showHeat} />

      {showBins
        ? bins.map((bin) => (
            <CircleMarker
              key={bin.id}
              center={[bin.lat, bin.lng]}
              radius={6}
              pathOptions={{
                color: fillColour(bin.fillPercent),
                fillColor: fillColour(bin.fillPercent),
                fillOpacity: 0.7,
                weight: 2,
                dashArray: bin.fillPercent === null ? "3 3" : undefined,
              }}
            >
              <Popup>
                <strong>{bin.label}</strong>
                <br />
                {bin.code}
                <br />
                {bin.fillPercent === null
                  ? "No sensor data yet"
                  : `${bin.fillPercent}% full`}
              </Popup>
            </CircleMarker>
          ))
        : null}

      {showReports
        ? reports.map((report) => (
            <CircleMarker
              key={report.id}
              center={[report.lat, report.lng]}
              radius={9}
              pathOptions={{
                color: BUCKET_COLOUR[report.bucket],
                fillColor: BUCKET_COLOUR[report.bucket],
                fillOpacity: 0.55,
                weight: 2,
              }}
            >
              <Popup>
                <strong>{report.category.replace("_", " ").toLowerCase()}</strong>
                <br />
                {report.bucket} &middot; {report.status.replace("_", " ").toLowerCase()}
                <br />
                <a href={`/reports/${report.id}`}>Follow this report</a>
              </Popup>
            </CircleMarker>
          ))
        : null}
    </MapContainer>
  );
}
