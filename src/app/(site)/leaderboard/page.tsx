import { leaderboard } from "@/server/analytics";

// Both pages read live data straight from MongoDB. Without this, Next
// prerenders them at build time and the "live" map is frozen at whatever the
// database held when the build ran.
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Leaderboard — CleanCity",
};

export default async function LeaderboardPage() {
  const rows = await leaderboard(20);
  const month = new Date().toLocaleString(undefined, {
    month: "long",
    year: "numeric",
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Leaderboard</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {month}. Ten points when a report is verified, five more once it is
        cleared. Resets each month, so a good week still counts.
      </p>

      {rows.length === 0 ? (
        <p className="mt-10 rounded-xl border p-6 text-sm text-muted-foreground">
          Nobody on the board yet this month. Reports count once a reviewer
          verifies them.
        </p>
      ) : (
        <ol className="mt-10 space-y-2">
          {rows.map((row, index) => (
            <li
              key={row.id}
              className="flex items-center gap-4 rounded-xl border p-4"
            >
              <span className="w-6 text-sm tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <span className="flex-1 text-sm">{row.name}</span>
              <span className="text-sm text-muted-foreground tabular-nums">
                {row.reports} report{row.reports === 1 ? "" : "s"}
              </span>
              <span className="w-16 text-right font-medium tabular-nums">
                {row.points}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Reports filed with a hidden name appear as “Anonymous resident”. Fully
        anonymous reports have no account to credit, so they do not appear here
        at all.
      </p>
    </main>
  );
}
