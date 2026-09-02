import { connectMongo } from "@/lib/mongo";
import { Bin } from "@/models/Bin";
import { Zone } from "@/models/Zone";

export default async function AdminBinsPage() {
  await connectMongo();

  const [bins, zones] = await Promise.all([
    Bin.find().sort({ code: 1 }).lean(),
    Zone.find().select("name").lean(),
  ]);

  const zoneName = new Map(zones.map((z) => [String(z._id), z.name]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Bins</h1>
        <p className="text-muted-foreground">
          Registry and device records. Fill levels stay empty until the sensor
          feed is switched on — the schema and endpoints are already in place.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="px-4 py-3 font-medium">Code</th>
              <th className="px-4 py-3 font-medium">Label</th>
              <th className="px-4 py-3 font-medium">Zone</th>
              <th className="px-4 py-3 font-medium">Capacity</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Device</th>
              <th className="px-4 py-3 font-medium">Fill</th>
            </tr>
          </thead>
          <tbody>
            {bins.map((bin) => (
              <tr key={String(bin._id)} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{bin.code}</td>
                <td className="px-4 py-3">{bin.label}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {zoneName.get(String(bin.zone)) ?? "—"}
                </td>
                <td className="px-4 py-3 tabular-nums">{bin.capacityLiters} L</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {bin.status.toLowerCase()}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {bin.device?.tokenHash ? "paired" : "—"}
                </td>
                <td className="px-4 py-3 tabular-nums text-muted-foreground">
                  {bin.latestReading?.fillPercent != null
                    ? `${bin.latestReading.fillPercent}%`
                    : "no data"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-sm text-muted-foreground">
        {bins.length} bins across {zones.length} zones.
      </p>
    </div>
  );
}
