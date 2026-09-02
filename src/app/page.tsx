import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Button } from "@/components/ui/button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { homePathForRole } from "@/lib/auth-helpers";

export default async function HomePage() {
  const session = await auth();

  if (session?.user && session.user.role !== "CITIZEN") {
    redirect(homePathForRole(session.user.role));
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <span className="text-lg font-semibold tracking-tight">CleanCity</span>
            <nav className="flex gap-4 text-sm text-muted-foreground">
              <Link href="/report" className="hover:text-foreground">
                Report
              </Link>
              <Link href="/map" className="hover:text-foreground">
                Map
              </Link>
              <Link href="/leaderboard" className="hover:text-foreground">
                Leaderboard
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            {session?.user ? (
              <>
                <span className="text-sm text-muted-foreground">
                  {session.user.email}
                </span>
                <Link
                  href="/me"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  My reports
                </Link>
                <SignOutButton />
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className={cn(buttonVariants({ size: "sm" }))}
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center gap-8 px-6 py-16">
        <div className="space-y-4">
          <p className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
            Phase 1 · Data and auth
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
            One queue for sensors and citizens.
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            IoT bin fill levels and photo reports feed the same map, priority
            queue, and status thread — so crews know what to fix and reporters
            know it was handled.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button disabled>Report waste</Button>
          <Button variant="outline" disabled>
            View map
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          {session?.user
            ? `Signed in as ${session.user.role.toLowerCase()}.`
            : "Sign in to track reports and earn points."}
        </p>
      </main>
    </div>
  );
}
