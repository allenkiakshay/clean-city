import {
  binPlacementSuggestions,
  bucketBreakdown,
  categoryBreakdown,
  reportTrend,
  resolutionByZone,
  slaCompliance,
} from "@/server/analytics";
import { BucketChart, CategoryChart, TrendChart } from "./charts";

export default async function AdminAnalyticsPage() {
  const [trend, categories, buckets, sla, byZone, suggestions] =
    await Promise.all([
      reportTrend(30),
      categoryBreakdown(),
      bucketBreakdown(),
      slaCompliance(),
      resolutionByZone(),
      binPlacementSuggestions(),
    ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">
          Where waste keeps coming back, and how fast it gets cleared.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          label="SLA met"
          value={sla.percentOnTime === null ? "—" : `${sla.percentOnTime}%`}
          hint={`${sla.onTime} on time · ${sla.late} late`}
        />
        <Stat
          label="Open and overdue"
          value={sla.openBreached}
          hint="Past deadline, still open"
          alert={sla.openBreached > 0}
        />
        <Stat
          label="Suggested new bins"
          value={suggestions.length}
          hint="Repeat hotspots with no bin within 100 m"
        />
      </div>

      <Panel
        title="Reported vs resolved"
        description="Last 30 days. The gap is the backlog."
      >
        <TrendChart data={trend} />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="By category" description="All time">
          <CategoryChart data={categories} />
        </Panel>
        <Panel title="Open by priority" description="What is waiting right now">
          <BucketChart data={buckets} />
        </Panel>
      </div>

      <Panel
        title="Average resolution time by ward"
        description="From report to resolved"
      >
        {byZone.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing resolved yet.
          </p>
        ) : (
          <ul className="space-y-2">
            {byZone.map((row) => (
              <li
                key={row.zone}
                className="flex items-center justify-between text-sm"
              >
                <span>{row.zone}</span>
                <span className="text-muted-foreground tabular-nums">
                  {row.hours} h · {row.count} resolved
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title="Where the next bin should go"
        description="Grid cells with repeat litter, dumping or debris reports and no active bin within 100 m"
      >
        {suggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hotspot yet has enough repeat reports to justify a new bin.
          </p>
        ) : (
          <ul className="space-y-2">
            {suggestions.map((row) => (
              <li
                key={`${row.lat},${row.lng}`}
                className="flex items-center justify-between gap-4 text-sm"
              >
                <span className="tabular-nums">
                  {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {row.count} reports
                </span>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${row.lat},${row.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm underline"
                >
                  View
                </a>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: number | string;
  hint: string;
  alert?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${alert ? "border-red-600/40" : ""}`}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          alert ? "text-red-700 dark:text-red-400" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border p-5">
      <h2 className="text-sm font-medium">{title}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      {children}
    </section>
  );
}
