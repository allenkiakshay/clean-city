import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { buttonVariants } from "@/components/ui/button";
import { homePathForRole } from "@/lib/auth-helpers";
import { cn } from "@/lib/utils";
import { publicStats } from "@/server/analytics";

// Live counters, so the numbers are never stale at build time.
export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Anyone reports it",
    body: "A photo and your location. No account needed — sign in only if you want to follow it or earn points.",
  },
  {
    title: "It gets prioritised, not queued",
    body: "Every report is scored 0–100 from what it is, how many people confirmed it, and whether it is beside a school or hospital. Crews work the worst first.",
  },
  {
    title: "You find out what happened",
    body: "Verified, assigned, in progress, resolved — with a photo of the cleared site. This is the part most reporting apps never build.",
  },
];

export default async function HomePage() {
  const session = await auth();

  if (session?.user && session.user.role !== "CITIZEN") {
    redirect(homePathForRole(session.user.role));
  }

  const stats = await publicStats();

  return (
    <>
      <section className="mx-auto w-full max-w-5xl px-6 pb-16 pt-20">
        <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
          Municipal waste reporting
        </p>
        <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
          Report the mess. Watch it actually get cleared.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-muted-foreground">
          Photograph overflowing bins, dumped rubbish or roadside litter. Every
          report is scored, sent to a cleanup crew, and tracked until someone
          posts a photo proving it is gone.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/report" className={cn(buttonVariants({ size: "lg" }))}>
            Report waste
          </Link>
          <Link
            href="/map"
            className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
          >
            See the live map
          </Link>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {session?.user
            ? "You are signed in — your reports appear under My reports."
            : "You can report without an account. Signing in lets you track yours and earn points."}
        </p>
      </section>

      <section className="border-y bg-muted/30">
        <dl className="mx-auto grid max-w-5xl grid-cols-2 gap-px px-6 py-10 sm:grid-cols-4">
          <Stat label="Reports filed" value={stats.total} />
          <Stat label="Cleared" value={stats.resolved} />
          <Stat
            label="Average time to clear"
            value={
              stats.avgResolutionHours === null
                ? "—"
                : `${stats.avgResolutionHours} h`
            }
          />
          <Stat label="People reporting" value={stats.contributors} />
        </dl>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm tabular-nums text-muted-foreground">
                {index + 1}
              </span>
              <h3 className="mt-3 font-medium">{step.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-5xl px-6 pb-20">
        <div className="rounded-xl border p-6">
          <h2 className="font-medium">Built for sensors too</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            A fill-level sensor knows how full one bin is. It cannot see litter
            scattered <em>around</em> the bin, or a dump on a street with no bin
            at all. Both feeds write into the same pipeline, so a sensor reading
            and a neighbour&rsquo;s photo raise the same report&rsquo;s priority
            together.
          </p>
          <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
            Today{" "}
            <strong className="font-medium text-foreground">
              every report here comes from a person
            </strong>{" "}
            — the bin registry and sensor scoring are in place, the hardware
            feed is not switched on yet.
          </p>
        </div>
      </section>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="px-1">
      <dd className="text-3xl font-semibold tabular-nums">{value}</dd>
      <dt className="mt-1 text-sm text-muted-foreground">{label}</dt>
    </div>
  );
}
