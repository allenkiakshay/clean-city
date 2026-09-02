import Link from "next/link";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The public header.
 *
 * It used to live inside the landing page, which meant every other public page
 * — the map, the leaderboard, the report form — had no navigation at all: once
 * you left the home page there was no way back except the browser button.
 */
export async function SiteHeader() {
  const session = await auth();

  return (
    <header className="border-b">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            CleanCity
          </Link>
          <nav className="hidden gap-4 text-sm text-muted-foreground sm:flex">
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
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {session.user.email}
              </span>
              <Link
                href="/me"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                My reports
              </Link>
              <SignOutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                )}
              >
                Sign in
              </Link>
              <Link
                href="/report"
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Report waste
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
