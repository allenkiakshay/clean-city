import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { loadStats } from "@/server/queue";

export default async function AdminDashboardPage() {
  const stats = await loadStats();

  const tiles = [
    {
      title: "Needs review",
      description: "Citizen reports awaiting verification",
      value: stats.pending,
      href: "/admin/queue?filter=PENDING",
    },
    {
      title: "Open",
      description: "Verified, assigned or in progress",
      value: stats.open,
      href: "/admin/queue?filter=OPEN",
    },
    {
      title: "SLA breached",
      description: "Open reports past their deadline",
      value: stats.slaBreached,
      href: "/admin/queue?filter=OPEN",
      alert: stats.slaBreached > 0,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Admin dashboard</h1>
        <p className="text-muted-foreground">
          Every report, from every source, in one queue.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {tiles.map((tile) => (
          <Link key={tile.title} href={tile.href} className="block">
            <Card className={tile.alert ? "border-red-600/40" : undefined}>
              <CardHeader>
                <CardTitle>{tile.title}</CardTitle>
                <CardDescription>{tile.description}</CardDescription>
              </CardHeader>
              <CardContent
                className={`text-3xl font-semibold tabular-nums ${
                  tile.alert ? "text-red-700 dark:text-red-400" : ""
                }`}
              >
                {tile.value}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="Resolved" value={stats.resolved} />
        <Stat label="Rejected" value={stats.rejected} />
        <Stat label="Filed anonymously" value={stats.anonymous} />
        <Stat
          label="Avg. resolution"
          value={
            stats.avgResolutionHours === null
              ? "—"
              : `${stats.avgResolutionHours} h`
          }
        />
      </div>

      <p className="text-sm text-muted-foreground">
        Bin fill levels and the sensor feed arrive with the IoT phase — the
        registry at <Link href="/admin/bins" className="underline">bins</Link> is
        already populated.
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
