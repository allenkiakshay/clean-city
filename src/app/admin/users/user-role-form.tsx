"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["CITIZEN", "ADMIN", "WORKER"];

type UserRoleFormProps = {
  userId: string;
  currentRole: string;
};

export function UserRoleForm({ userId, currentRole }: UserRoleFormProps) {
  const router = useRouter();
  const [role, setRole] = useState<Role>(
    ROLES.includes(currentRole as Role) ? (currentRole as Role) : "CITIZEN",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setLoading(true);
    setError(null);

    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    const data: { error?: string } = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Could not update role.");
      return;
    }

    router.refresh();
  }

  return (
    <div className="flex items-center gap-2">
      <select
        className="rounded-md border bg-background px-2 py-1"
        value={role}
        onChange={(event) => setRole(event.target.value as Role)}
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <Button type="button" size="sm" onClick={handleSave} disabled={loading}>
        Save
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}
