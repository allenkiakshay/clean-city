import { auth } from "@/auth";
import { loadQueue, loadWorkers, type QueueFilter } from "@/server/queue";
import { QueueClient, type QueueRow } from "./queue-client";

function parseFilter(value: string | undefined): QueueFilter {
  return value === "OPEN" || value === "ALL" ? value : "PENDING";
}

export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const { filter: raw } = await searchParams;
  const filter = parseFilter(raw);

  const session = await auth();
  const viewer = {
    role: session?.user?.role ?? null,
    userId: session?.user?.id ?? null,
  };

  const [reports, workers] = await Promise.all([
    loadQueue(filter, viewer),
    loadWorkers(),
  ]);

  // The queue is staff-only, so every row carries the staff shape.
  const rows: QueueRow[] = reports.map((report) => ({
    id: report.id,
    category: report.category,
    status: report.status,
    priorityBucket: report.priorityBucket,
    priorityScore: "priorityScore" in report ? report.priorityScore : 0,
    location: report.location,
    address: report.address,
    description: report.description,
    photoUrl: report.photoUrl,
    reporterLabel: report.reporterLabel,
    isAnonymous: "isAnonymous" in report ? report.isAnonymous : false,
    reporterName: "reporter" in report ? (report.reporter?.name ?? null) : null,
    reporterTrust:
      "reporter" in report ? (report.reporter?.trustScore ?? null) : null,
    confirmationCount: report.confirmationCount,
    createdAt: report.createdAt ? new Date(report.createdAt).toISOString() : null,
    slaDueAt:
      "slaDueAt" in report && report.slaDueAt
        ? new Date(report.slaDueAt).toISOString()
        : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Verification queue</h1>
        <p className="text-muted-foreground">
          Sorted by priority score, highest first. Confirmations and zone
          sensitivity are already folded into the number.
        </p>
      </div>

      <QueueClient rows={rows} workers={workers} filter={filter} />
    </div>
  );
}
