"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { downscaleImage } from "@/lib/image";

/**
 * The field controls. Designed to be usable one-handed, standing next to a pile
 * of rubbish — big targets, one decision per screen, and no way to close a task
 * without the after photo the reporter was promised.
 */
export function TaskActions({
  taskId,
  status,
}: {
  taskId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [afterPhotoUrl, setAfterPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);

    try {
      const response = await fetch(`/api/worker/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "That did not go through.");

      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
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

      setAfterPhotoUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not upload that photo.");
    } finally {
      setUploading(false);
    }
  }

  const disabled = busy || pending || uploading;

  return (
    <div className="space-y-4">
      {error ? (
        <p className="rounded-md border border-destructive/40 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {status === "ASSIGNED" ? (
        <Button size="lg" className="w-full" disabled={disabled} onClick={() => act({ action: "START" })}>
          Start work
        </Button>
      ) : null}

      {status === "IN_PROGRESS" ? (
        <div className="space-y-3">
          <div>
            <label htmlFor="after" className="text-sm font-medium">
              After photo
            </label>
            <p className="mb-2 text-sm text-muted-foreground">
              Required. This is what the person who reported it will see.
            </p>
            <input
              id="after"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onPhoto}
              disabled={disabled}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-2 file:text-sm"
            />
          </div>

          {uploading ? (
            <p className="text-sm text-muted-foreground">Uploading…</p>
          ) : afterPhotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={afterPhotoUrl} alt="After cleanup" className="max-h-56 rounded-md border" />
          ) : null}

          <Button
            size="lg"
            className="w-full"
            disabled={disabled || !afterPhotoUrl}
            onClick={() => act({ action: "RESOLVE", afterPhotoUrl })}
          >
            Mark resolved
          </Button>
        </div>
      ) : null}

      {status === "RESOLVED" ? (
        <p className="rounded-md border border-input p-4 text-sm text-muted-foreground">
          Done. The reporter has been notified.
        </p>
      ) : null}
    </div>
  );
}
