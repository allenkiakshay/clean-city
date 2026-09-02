import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { loadTask } from "@/server/worker";
import { TaskActions } from "./task-actions";

export default async function WorkerTaskPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const viewer = {
    role: session?.user?.role ?? null,
    userId: session?.user?.id ?? null,
  };

  const task = await loadTask(id, viewer);
  if (!task) notFound();

  const { lat, lng } = task.location;
  // `in` narrowing over the public/staff union widens the field, so coerce once.
  const dueRaw: unknown = "slaDueAt" in task ? task.slaDueAt : null;
  const due =
    dueRaw instanceof Date
      ? dueRaw
      : typeof dueRaw === "string"
        ? new Date(dueRaw)
        : null;
  const overdue = due !== null && due < new Date();

  return (
    <div className="space-y-6">
      <Link href="/worker" className="text-sm text-muted-foreground underline">
        ← All tasks
      </Link>

      <div>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          {task.priorityBucket}
          {"priorityScore" in task ? ` · ${task.priorityScore}` : null}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">
          {task.category.replace("_", " ").toLowerCase()}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {task.status.replace("_", " ").toLowerCase()}
          {due ? (
            <>
              {" · "}
              <span className={overdue ? "text-red-700 dark:text-red-400" : ""}>
                {overdue ? "overdue" : `due ${due.toLocaleString()}`}
              </span>
            </>
          ) : null}
        </p>
      </div>

      {task.description ? <p className="text-sm">{task.description}</p> : null}

      {task.photoUrl ? (
        <figure>
          <figcaption className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            As reported
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={task.photoUrl} alt="The waste as reported" className="rounded-md border" />
        </figure>
      ) : null}

      <div className="rounded-xl border p-4">
        <p className="text-sm tabular-nums text-muted-foreground">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </p>
        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-block text-sm underline"
        >
          Navigate here
        </a>
      </div>

      <TaskActions taskId={task.id} status={task.status} />

      {task.afterPhotoUrl ? (
        <figure>
          <figcaption className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
            After cleanup
          </figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.afterPhotoUrl}
            alt="The same place after cleanup"
            className="rounded-md border"
          />
        </figure>
      ) : null}
    </div>
  );
}
