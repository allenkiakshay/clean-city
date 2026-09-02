import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { connectMongo } from "@/lib/mongo";
import { toPublicReport, type Viewer } from "@/lib/redact";
import type { ReportStatus } from "@/lib/types";
import { Report } from "@/models/Report";

/** The citizen-facing journey. REJECTED is terminal and sits outside it. */
const JOURNEY: ReportStatus[] = [
  "SUBMITTED",
  "VERIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
];

const STATUS_LABEL: Record<ReportStatus, string> = {
  SUBMITTED: "Reported",
  VERIFIED: "Verified",
  ASSIGNED: "Crew assigned",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

export default async function ReportStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  await connectMongo();

  const report = await Report.findById(id)
    .populate("reporter", "name email trustScore")
    .lean();

  if (!report) notFound();

  const session = await auth();
  const viewer: Viewer = {
    role: session?.user?.role ?? null,
    userId: session?.user?.id ?? null,
  };

  const view = toPublicReport(report as never, viewer);

  // The claim token proves this is the anonymous reporter coming back via their
  // private link. It grants the claim offer — nothing else.
  const holdsClaimLink =
    Boolean(t) && report.reporterMode === "NONE" && report.claimToken === t;

  const stepIndex = JOURNEY.indexOf(view.status);
  const rejected = view.status === "REJECTED";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">
        {view.category.replace("_", " ").toLowerCase()}
      </p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {STATUS_LABEL[view.status]}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Reported by {view.reporterLabel}
        {view.createdAt
          ? ` on ${new Date(view.createdAt).toLocaleDateString()}`
          : null}
        {view.confirmationCount > 0
          ? ` · ${view.confirmationCount} ${
              view.confirmationCount === 1 ? "person has" : "people have"
            } confirmed this`
          : null}
      </p>

      {rejected ? (
        <p className="mt-8 rounded-md border border-input p-4 text-sm text-muted-foreground">
          A reviewer decided this did not need a cleanup crew.
        </p>
      ) : (
        <ol className="mt-8 space-y-3">
          {JOURNEY.map((step, index) => {
            const done = index <= stepIndex;
            return (
              <li key={step} className="flex items-center gap-3 text-sm">
                <span
                  aria-hidden
                  className={`h-2.5 w-2.5 rounded-full ${
                    done ? "bg-foreground" : "bg-muted-foreground/30"
                  }`}
                />
                <span className={done ? "" : "text-muted-foreground"}>
                  {STATUS_LABEL[step]}
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {view.description ? (
        <p className="mt-8 text-sm">{view.description}</p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {view.photoUrl ? (
          <figure>
            <figcaption className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Reported
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={view.photoUrl}
              alt="The waste as reported"
              className="rounded-md border"
            />
          </figure>
        ) : null}

        {view.afterPhotoUrl ? (
          <figure>
            <figcaption className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              After cleanup
            </figcaption>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={view.afterPhotoUrl}
              alt="The same place after the crew cleaned it"
              className="rounded-md border"
            />
          </figure>
        ) : null}
      </div>

      {"reporter" in view ? (
        <div className="mt-10 rounded-md border border-input p-4">
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">
            Staff view
          </h2>
          <p className="mt-2 text-sm">
            {view.isAnonymous ? (
              <>
                Filed anonymously &mdash; there is no account behind this report.
              </>
            ) : (
              <>
                Filed by {view.reporter?.name ?? "unknown"}
                {view.reporter?.email ? ` (${view.reporter.email})` : null}
                {view.reporter?.trustScore != null
                  ? ` · trust ${view.reporter.trustScore}`
                  : null}
                {report.reporterMode === "HIDDEN"
                  ? " · name hidden from the public"
                  : null}
              </>
            )}
          </p>
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            Priority {view.priorityScore} ({view.priorityBucket})
            {view.slaDueAt
              ? ` · due ${new Date(view.slaDueAt).toLocaleString()}`
              : null}
          </p>
        </div>
      ) : null}

      {holdsClaimLink ? (
        <div className="mt-10 rounded-md border border-input p-4">
          <h2 className="text-sm font-medium">This is your anonymous report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Bookmark this link — it is the only way back. If you make an account
            you can attach this report to it and keep the points.
          </p>
          <Link href="/register" className="mt-2 inline-block text-sm underline">
            Create an account
          </Link>
        </div>
      ) : null}

      <div className="mt-10 border-t pt-6">
        <h2 className="text-sm font-medium">History</h2>
        <ul className="mt-3 space-y-2">
          {view.timeline.map((entry, index) => (
            <li key={index} className="text-sm text-muted-foreground">
              <span className="text-foreground">
                {entry.type.replace("_", " ").toLowerCase()}
              </span>
              {" · "}
              {new Date(entry.at).toLocaleString()}
              {entry.note ? ` — ${entry.note}` : null}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
