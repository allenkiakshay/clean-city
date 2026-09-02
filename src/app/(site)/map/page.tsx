import { heatPoints, loadMapData } from "@/server/analytics";
import { MapView } from "./map-view";

// Both pages read live data straight from MongoDB. Without this, Next
// prerenders them at build time and the "live" map is frozen at whatever the
// database held when the build ran.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Live map — CleanCity",
};

export default async function MapPage() {
  const [{ reports, bins }, heat] = await Promise.all([
    loadMapData(),
    heatPoints(),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Live map</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every open report in the city. Turn on the heatmap to see where waste
        keeps coming back — those are the places worth putting a bin.
      </p>

      <div className="mt-8">
        <MapView
          reports={reports}
          bins={bins}
          heat={heat.map((point) => ({
            lat: point.lat,
            lng: point.lng,
            weight: point.weight,
          }))}
        />
      </div>
    </main>
  );
}
