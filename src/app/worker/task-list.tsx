"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { haversineMeters, type LatLng } from "@/lib/geo";
import type { PriorityBucket } from "@/lib/types";

export type Task = {
  id: string;
  category: string;
  status: string;
  priorityBucket: PriorityBucket;
  priorityScore: number;
  location: LatLng;
  description: string | null;
  photoUrl: string | null;
  slaDueAt: string | null;
};

const BUCKET_CLASS: Record<PriorityBucket, string> = {
  LOW: "border-emerald-600/40 text-emerald-700 dark:text-emerald-400",
  MEDIUM: "border-amber-600/40 text-amber-700 dark:text-amber-400",
  HIGH: "border-orange-600/40 text-orange-700 dark:text-orange-400",
  CRITICAL: "border-red-600/40 text-red-700 dark:text-red-400",
};

function formatDistance(metres: number): string {
  return metres < 1000
    ? `${Math.round(metres / 10) * 10} m`
    : `${(metres / 1000).toFixed(1)} km`;
}

function dueLabel(slaDueAt: string | null): { text: string; late: boolean } | null {
  if (!slaDueAt) return null;
  const due = new Date(slaDueAt).getTime();
  const diff = due - Date.now();
  if (diff < 0) return { text: "overdue", late: true };
  const hours = Math.round(diff / 3_600_000);
  return { text: hours < 1 ? "due within the hour" : `due in ${hours} h`, late: false };
}

export function TaskList({ tasks }: { tasks: Task[] }) {
  const [here, setHere] = useState<LatLng | null>(null);
  const [sortBy, setSortBy] = useState<"priority" | "distance">("priority");

  // Distance sorting happens entirely in the browser — the server never sees
  // the crew's live position.
  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setHere({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => undefined,
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }, []);

  const rows = useMemo(() => {
    const withDistance = tasks.map((task) => ({
      task,
      metres: here ? haversineMeters(here, task.location) : null,
    }));

    if (sortBy === "distance" && here) {
      return [...withDistance].sort((a, b) => (a.metres ?? 0) - (b.metres ?? 0));
    }

    return withDistance;
  }, [tasks, here, sortBy]);

  if (tasks.length === 0) {
    return (
      <p className="rounded-xl border p-6 text-sm text-muted-foreground">
        Nothing assigned to you right now.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sort by</span>
        {(["priority", "distance"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setSortBy(value)}
            disabled={value === "distance" && !here}
            className={`rounded-md border px-3 py-1.5 ${
              sortBy === value ? "border-foreground" : "border-input text-muted-foreground"
            } disabled:opacity-40`}
          >
            {value}
          </button>
        ))}
        {!here ? (
          <span className="text-xs text-muted-foreground">
            (allow location to sort by distance)
          </span>
        ) : null}
      </div>

      <ul className="space-y-3">
        {rows.map(({ task, metres }) => {
          const due = dueLabel(task.slaDueAt);
          return (
            <li key={task.id}>
              <Link
                href={`/worker/tasks/${task.id}`}
                className="block rounded-xl border p-4 active:bg-muted/50"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded border px-2 py-0.5 text-xs font-medium tabular-nums ${
                      BUCKET_CLASS[task.priorityBucket]
                    }`}
                  >
                    {task.priorityBucket} {task.priorityScore}
                  </span>
                  <span className="text-base font-medium">
                    {task.category.replace("_", " ").toLowerCase()}
                  </span>
                  {task.status === "IN_PROGRESS" ? (
                    <span className="text-xs text-muted-foreground">in progress</span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm text-muted-foreground">
                  {metres !== null ? formatDistance(metres) : "distance unknown"}
                  {due ? (
                    <>
                      {" · "}
                      <span className={due.late ? "text-red-700 dark:text-red-400" : ""}>
                        {due.text}
                      </span>
                    </>
                  ) : null}
                </p>

                {task.description ? (
                  <p className="mt-2 line-clamp-2 text-sm">{task.description}</p>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
