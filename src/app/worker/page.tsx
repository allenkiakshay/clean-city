import { auth } from "@/auth";
import { loadTasks } from "@/server/worker";
import { TaskList, type Task } from "./task-list";

export default async function WorkerHomePage() {
  const session = await auth();
  const viewer = {
    role: session?.user?.role ?? null,
    userId: session?.user?.id ?? null,
  };

  const reports = await loadTasks(session!.user.id, viewer);

  const tasks: Task[] = reports.map((report) => ({
    id: report.id,
    category: report.category,
    status: report.status,
    priorityBucket: report.priorityBucket,
    priorityScore: "priorityScore" in report ? report.priorityScore : 0,
    location: report.location,
    description: report.description,
    photoUrl: report.photoUrl,
    slaDueAt:
      "slaDueAt" in report && report.slaDueAt
        ? new Date(report.slaDueAt).toISOString()
        : null,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Your tasks</h1>
        <p className="text-muted-foreground">
          Worst first. Switch to distance once you are out on the round.
        </p>
      </div>

      <TaskList tasks={tasks} />
    </div>
  );
}
