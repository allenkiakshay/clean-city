"use client";

import L from "leaflet";
import "leaflet.heat";
import { useEffect } from "react";
import { useMap } from "react-leaflet";

/**
 * leaflet.heat is a plugin: importing it patches `L` with `heatLayer` rather
 * than exporting anything, which is why the import has no binding and why the
 * layer is attached imperatively instead of through a react-leaflet component.
 */
export function HeatLayer({
  points,
  visible,
}: {
  points: { lat: number; lng: number; weight: number }[];
  visible: boolean;
}) {
  const map = useMap();

  useEffect(() => {
    if (!visible || points.length === 0) return;

    const layer = L.heatLayer(
      points.map((p) => [p.lat, p.lng, p.weight] as [number, number, number]),
      { radius: 28, blur: 20, maxZoom: 17, minOpacity: 0.25 },
    );

    layer.addTo(map);
    return () => {
      map.removeLayer(layer);
    };
  }, [map, points, visible]);

  return null;
}
