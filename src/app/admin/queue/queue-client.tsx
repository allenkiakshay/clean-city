"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { ReportMap, type MapPoint } from "@/components/map/report-map";
import { Button } from "@/components/ui/button";
import { errorMessage, readJson } from "@/lib/http";
import type { PriorityBucket } from "@/lib/types";

export type QueueRow = {
  id: string;
  category: string;
  status: string;
  priorityBucket: PriorityBucket;
  priorityScore: number;
  location: { lat: number; lng: number };
  address: string | null;
  description: string | null;
  photoUrl: string | null;
  reporterLabel: string;
  isAnonymous: boolean;
  reporterName: string | null;
  reporterTrust: number | null;
  confirmationCount: number;
  createdAt: string | null;
  slaDueAt: string | null;
};

const BUCKET_CLASS: Record<PriorityBucket, string> = {
  LOW: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  MEDIUM: "border-amber-600/40 text-amber-700 dark:text-amber-400",
  HIGH: "border-orange-600/40 text-orange-700 dark:text-orange-400",
  CRITICAL: "border-red-600/40 text-red-700 dark:text-red-400",
};

export function QueueClient({
  rows,
  workers,
  filter,
}: {
  rows: QueueRow[];
  workers: { id: string; name: string }[];
  filter: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [selectedId, setSelectedId] = useState<string | null>(
    rows[0]?.id ?? null,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergeSource, setMergeSource] = useState<string | null>(null);

  const points = useMemo<MapPoint[]>(
    () =>
      rows.map((row) => ({
        id: row.id,
        lat: row.location.lat,
        lng: row.location.lng,
        label: row.category.replace("_", " ").toLowerCase(),
        bucket: row.priorityBucket,
        status: row.status,
      })),
    [rows],
  );

  async function act(id: string, body: Record<string, unknown>) {
    setBusyId(id);
    setError(null);

    try {
      const response = await fetch(`/api/admin/reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      await readJson<{ status?: string }>(response);

      setMergeSource(null);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(errorMessage(err, "That action did not go through."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["PENDING", "OPEN", "ALL"] as const).map((value) => (
          <Link
            key={value}
            href={`/admin/queue?filter=${value}`}
            className={`rounded-md border px-3 py-1.5 text-sm ${
              filter === value
                ? "border-foreground"
                : "border-input text-muted-foreground"
            }`}
          >
            {value === "PENDING"
              ? "Needs review"
              : value === "OPEN"
                ? "Open"
                : "All"}
          </Link>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">
          {rows.length} report{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {mergeSource ? (
        <p className="rounded-md border border-input px-3 py-2 text-sm">
          Pick the report to keep — the merged one closes and its reporter is
          counted as a confirmation.{" "}
          <button
            type="button"
            onClick={() => setMergeSource(null)}
            className="underline"
          >
            Cancel
          </button>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-3">
          {rows.length === 0 ? (
            <p className="rounded-xl border p-6 text-sm text-muted-foreground">
              Nothing here. Reports appear as citizens send them in.
            </p>
          ) : null}

          {rows.map((row) => {
            const breached =
              row.slaDueAt !== null && new Date(row.slaDueAt) < new Date();

            return (
              <article
                key={row.id}
                onMouseEnter={() => setSelectedId(row.id)}
                className={`rounded-xl border p-4 ${
                  selectedId === row.id ? "border-foreground" : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-medium tabular-nums ${
                      BUCKET_CLASS[row.priorityBucket]
                    }`}
                  >
                    {row.priorityBucket} {row.priorityScore}
                  </span>
                  <span className="text-sm font-medium">
                    {row.category.replace("_", " ").toLowerCase()}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {row.status.replace("_", " ").toLowerCase()}
                  </span>
                  {row.isAnonymous ? (
                    <span className="rounded border border-input px-2 py-0.5 text-xs text-muted-foreground">
                      anonymous
                    </span>
                  ) : null}
                  {breached ? (
                    <span className="rounded border border-red-600/40 px-2 py-0.5 text-xs text-red-700 dark:text-red-400">
                      SLA breached
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {row.isAnonymous
                    ? "Filed anonymously"
                    : `${row.reporterName ?? row.reporterLabel}${
                        row.reporterTrust !== null
                          ? ` · trust ${row.reporterTrust}`
                          : ""
                      }`}
                  {row.confirmationCount > 0
                    ? ` · ${row.confirmationCount} confirmation${
                        row.confirmationCount === 1 ? "" : "s"
                      }`
                    : null}
                </p>

                {row.description ? (
                  <p className="mt-2 text-sm">{row.description}</p>
                ) : null}

                {row.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={row.photoUrl}
                    alt=""
                    className="mt-3 max-h-40 rounded-md border"
                  />
                ) : null}

                <Actions
                  row={row}
                  workers={workers}
                  busy={busyId === row.id || pending}
                  mergeSource={mergeSource}
                  onMergeStart={() => setMergeSource(row.id)}
                  onMergeInto={() =>
                    mergeSource &&
                    act(mergeSource, {
                      action: "MERGE",
                      targetId: row.id,
                    })
                  }
                  onAct={act}
                />
              </article>
            );
          })}
        </div>

        <div className="lg:sticky lg:top-6 lg:h-fit">
          <ReportMap
            points={points}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            Colour is the priority bucket. Click a circle to highlight it in the
            list.
          </p>
        </div>
      </div>
    </div>
  );
}

function Actions({
  row,
  workers,
  busy,
  mergeSource,
  onMergeStart,
  onMergeInto,
  onAct,
}: {
  row: QueueRow;
  workers: { id: string; name: string }[];
  busy: boolean;
  mergeSource: string | null;
  onMergeStart: () => void;
  onMergeInto: () => void;
  onAct: (id: string, body: Record<string, unknown>) => void;
}) {
  const [worker, setWorker] = useState(workers[0]?.id ?? "");

  if (mergeSource && mergeSource !== row.id) {
    return (
      <div className="mt-3">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onMergeInto}
        >
          Merge into this one
        </Button>
      </div>
    );
  }

  if (mergeSource === row.id) {
    return (
      <p className="mt-3 text-sm text-muted-foreground">
        Choose the report to fold this into.
      </p>
    );
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {row.status === "SUBMITTED" ? (
        <>
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onAct(row.id, { action: "VERIFY" })}
          >
            Verify
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={() => onAct(row.id, { action: "REJECT" })}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={onMergeStart}
          >
            Merge…
          </Button>
        </>
      ) : null}

      {row.status === "VERIFIED" || row.status === "ASSIGNED" ? (
        <>
          <select
            value={worker}
            onChange={(event) => setWorker(event.target.value)}
            className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
          >
            {workers.length === 0 ? (
              <option value="">No crew yet</option>
            ) : null}
            {workers.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            disabled={busy || !worker}
            onClick={() =>
              onAct(row.id, { action: "ASSIGN", workerId: worker })
            }
          >
            {row.status === "ASSIGNED" ? "Reassign" : "Assign"}
          </Button>
        </>
      ) : null}

      <Link
        href={`/reports/${row.id}`}
        className="text-sm text-muted-foreground underline"
      >
        Open
      </Link>
    </div>
  );
}
