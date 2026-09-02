"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { downscaleImage } from "@/lib/image";
import { REPORT_CATEGORIES, type ReportCategory, type ReporterMode } from "@/lib/types";

const CATEGORY_LABELS: Record<ReportCategory, string> = {
  OVERFLOW: "Overflowing bin",
  LITTER: "Scattered litter",
  ILLEGAL_DUMP: "Illegal dumping",
  DEAD_ANIMAL: "Dead animal",
  DEBRIS: "Construction debris",
};

type Position = { lat: number; lng: number; accuracy: number };

const CLAIM_STORAGE_KEY = "cleancity.claims";

/** An anonymous report has no account behind it, so the private link is the
 *  only way back to it. Keep a copy in this browser. */
function rememberClaimLink(reportId: string, claimUrl: string) {
  try {
    const raw = window.localStorage.getItem(CLAIM_STORAGE_KEY);
    const saved = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    saved[reportId] = claimUrl;
    window.localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Private browsing or blocked storage — the on-screen link still works.
  }
}

type Outcome =
  | { kind: "created"; reportId: string; status: string; claimUrl: string | null }
  | { kind: "confirmed"; reportId: string; message: string }
  | { kind: "duplicate"; reportId: string; message: string };

export function ReportForm({
  signedIn,
  displayName,
  defaultHideName,
}: {
  signedIn: boolean;
  displayName: string | null;
  defaultHideName: boolean;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);

  const [category, setCategory] = useState<ReportCategory>("OVERFLOW");
  const [description, setDescription] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);

  const [mode, setMode] = useState<ReporterMode>(
    !signedIn ? "NONE" : defaultHideName ? "HIDDEN" : "NAMED",
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  // The browser callbacks are async, so nothing here sets state synchronously
  // inside the effect — the retry handler below is where that belongs.
  const requestPosition = useCallback(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was declined. Allow it to place your report on the map."
            : "Could not get your location. Try again outdoors.",
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 },
    );
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      const id = setTimeout(() => {
        setLocating(false);
        setLocationError("This browser cannot share your location.");
      }, 0);
      return () => clearTimeout(id);
    }

    requestPosition();
  }, [requestPosition]);

  function retryLocate() {
    setLocating(true);
    setLocationError(null);
    requestPosition();
  }

  async function onPhotoChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setPhotoBusy(true);
    setError(null);

    try {
      const resized = await downscaleImage(file);
      const body = new FormData();
      body.set("file", resized);

      const response = await fetch("/api/upload", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not upload that photo.");
      }

      setPhotoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setPhotoBusy(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    if (!position) {
      setError("We need your location before you can send a report.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: position.lat,
          lng: position.lng,
          category,
          description: description.trim() || undefined,
          photoUrl: photoUrl ?? undefined,
          requestedMode: mode,
        }),
      });

      const data = (await response.json()) as Outcome & { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not send your report.");
      }

      if (data.kind === "created" && data.claimUrl) {
        rememberClaimLink(data.reportId, data.claimUrl);
      }

      setOutcome(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your report.");
    } finally {
      setSubmitting(false);
    }
  }

  if (outcome) {
    return <OutcomePanel outcome={outcome} />;
  }

  return (
    <form onSubmit={onSubmit} className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Location</h2>
        {locating ? (
          <p className="text-sm text-muted-foreground">Finding your location…</p>
        ) : position ? (
          <p className="text-sm text-muted-foreground tabular-nums">
            {position.lat.toFixed(5)}, {position.lng.toFixed(5)}{" "}
            <span className="opacity-70">
              (±{Math.round(position.accuracy)} m)
            </span>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-destructive">{locationError}</p>
            <Button type="button" variant="outline" size="sm" onClick={retryLocate}>
              Try again
            </Button>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">What did you find?</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {REPORT_CATEGORIES.map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm ${
                category === value ? "border-foreground" : "border-input"
              }`}
            >
              <input
                type="radio"
                name="category"
                value={value}
                checked={category === value}
                onChange={() => setCategory(value)}
                className="accent-foreground"
              />
              {CATEGORY_LABELS[value]}
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium">Photo</h2>
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onPhotoChange}
          disabled={photoBusy}
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-sm"
        />
        {photoBusy ? (
          <p className="text-sm text-muted-foreground">Uploading…</p>
        ) : photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="The waste you reported"
            className="mt-2 max-h-56 rounded-md border"
          />
        ) : null}
      </section>

      <section className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Anything else? <span className="text-muted-foreground">(optional)</span>
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Next to the bus stop, spilling onto the footpath."
          className="w-full rounded-md border border-input bg-background p-3 text-sm"
        />
      </section>

      <ModeSelector
        mode={mode}
        setMode={setMode}
        signedIn={signedIn}
        displayName={displayName}
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" disabled={submitting || !position || photoBusy}>
        {submitting ? "Sending…" : "Send report"}
      </Button>
    </form>
  );
}

function ModeSelector({
  mode,
  setMode,
  signedIn,
  displayName,
}: {
  mode: ReporterMode;
  setMode: (mode: ReporterMode) => void;
  signedIn: boolean;
  displayName: string | null;
}) {
  if (!signedIn) {
    return (
      <section className="space-y-2 rounded-md border border-input p-4">
        <h2 className="text-sm font-medium">Posting anonymously</h2>
        <p className="text-sm text-muted-foreground">
          You are not signed in, so this report will not be linked to anyone. We
          will give you a private link so you can follow what happens to it.
        </p>
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="underline">
            Sign in
          </Link>{" "}
          instead to earn points and see all your reports in one place.
        </p>
      </section>
    );
  }

  const options: { value: ReporterMode; label: string; help: string }[] = [
    {
      value: "NAMED",
      label: `Post as ${displayName ?? "me"}`,
      help: "Your name is shown publicly on the report.",
    },
    {
      value: "HIDDEN",
      label: "Hide my name",
      help: "The public sees “A resident”. Municipal staff can still see your name.",
    },
    {
      value: "NONE",
      label: "Post anonymously",
      help: "Not linked to your account at all — so no points, and no entry in your reports.",
    },
  ];

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">How should this appear?</h2>
      <div className="space-y-2">
        {options.map((option) => (
          <label
            key={option.value}
            className={`flex cursor-pointer gap-3 rounded-md border p-3 ${
              mode === option.value ? "border-foreground" : "border-input"
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => setMode(option.value)}
              className="mt-1 accent-foreground"
            />
            <span>
              <span className="block text-sm">{option.label}</span>
              <span className="block text-sm text-muted-foreground">
                {option.help}
              </span>
            </span>
          </label>
        ))}
      </div>
    </section>
  );
}

function OutcomePanel({ outcome }: { outcome: Outcome }) {
  if (outcome.kind === "created") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-medium">Report sent</h2>
        <p className="text-sm text-muted-foreground">
          {outcome.status === "VERIFIED"
            ? "Your reporting history meant this skipped review — it is already queued for a crew."
            : "It is now with the municipal team for verification."}
        </p>

        {outcome.claimUrl ? (
          <div className="space-y-2 rounded-md border border-input p-4">
            <h3 className="text-sm font-medium">Save this link</h3>
            <p className="text-sm text-muted-foreground">
              You reported anonymously, so this private link is the only way back
              to it. It is saved in this browser too.
            </p>
            <Link
              href={outcome.claimUrl}
              className="block break-all text-sm underline"
            >
              {outcome.claimUrl}
            </Link>
          </div>
        ) : (
          <Link href={`/reports/${outcome.reportId}`} className="text-sm underline">
            Follow this report
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-medium">
        {outcome.kind === "confirmed" ? "Thanks — that helps" : "Already reported"}
      </h2>
      <p className="text-sm text-muted-foreground">{outcome.message}</p>
      <Link href={`/reports/${outcome.reportId}`} className="text-sm underline">
        See the existing report
      </Link>
    </div>
  );
}
