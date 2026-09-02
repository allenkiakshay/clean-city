import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default async function MePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-16">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">My account</h1>
          <p className="text-muted-foreground">{session.user.email}</p>
        </div>
        <SignOutButton />
      </div>
      <div className="rounded-xl border p-6 text-sm text-muted-foreground">
        Reports, points, and trust score arrive in Phase 2.
      </div>
      <Link
        href="/"
        className={cn(buttonVariants({ variant: "outline" }), "w-fit")}
      >
        Back home
      </Link>
    </div>
  );
}
