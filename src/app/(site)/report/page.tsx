import { auth } from "@/auth";
import { ReportForm } from "@/components/report/report-form";
import { connectMongo } from "@/lib/mongo";
import { User } from "@/models/User";

export const metadata = {
  title: "Report waste — CleanCity",
};

export default async function ReportPage() {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  let defaultHideName = false;

  if (userId) {
    await connectMongo();
    const user = await User.findById(userId).select("hideNameByDefault").lean();
    defaultHideName = Boolean(user?.hideNameByDefault);
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Report waste</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        A photo and your location are enough. Anyone can report — an account just
        lets you follow yours and earn points.
      </p>

      <div className="mt-10">
        <ReportForm
          signedIn={Boolean(userId)}
          displayName={session?.user?.name ?? null}
          defaultHideName={defaultHideName}
        />
      </div>
    </main>
  );
}
