import type { ReportStatus, Role } from "@/lib/types";

/**
 * The report state machine.
 *
 * Every transition is checked here before anything is written, and the check is
 * a pure function so the whole table is testable without a database. Illegal
 * moves throw rather than silently no-op — a report must never change state by
 * accident, and "nothing happened" is the worst possible bug in a system whose
 * entire promise is that the citizen can see what happened.
 */

export type TransitionAction =
  | "VERIFY"
  | "REJECT"
  | "ASSIGN"
  | "START"
  | "RESOLVE";

type Rule = {
  from: ReportStatus[];
  to: ReportStatus;
  roles: Role[];
  /** Timeline entry type written when this transition succeeds. */
  event: string;
};

export const TRANSITIONS: Record<TransitionAction, Rule> = {
  VERIFY: {
    from: ["SUBMITTED"],
    to: "VERIFIED",
    roles: ["ADMIN"],
    event: "VERIFIED",
  },
  REJECT: {
    from: ["SUBMITTED"],
    to: "REJECTED",
    roles: ["ADMIN"],
    event: "REJECTED",
  },
  ASSIGN: {
    from: ["VERIFIED", "ASSIGNED"],
    to: "ASSIGNED",
    roles: ["ADMIN"],
    event: "ASSIGNED",
  },
  START: {
    from: ["ASSIGNED"],
    to: "IN_PROGRESS",
    roles: ["WORKER"],
    event: "STARTED",
  },
  RESOLVE: {
    from: ["IN_PROGRESS", "ASSIGNED"],
    to: "RESOLVED",
    roles: ["WORKER", "ADMIN"],
    event: "RESOLVED",
  },
};

/** Statuses from which nothing further can happen. */
export const TERMINAL_STATUSES: ReportStatus[] = ["RESOLVED", "REJECTED"];

export function isTerminal(status: ReportStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export class TransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransitionError";
  }
}

export function canTransition(
  action: TransitionAction,
  from: ReportStatus,
  role: Role | null,
): boolean {
  const rule = TRANSITIONS[action];
  if (!rule) return false;
  if (!role || !rule.roles.includes(role)) return false;
  return rule.from.includes(from);
}

/**
 * Returns the next status and the timeline event type, or throws with a reason
 * a human can act on.
 */
export function applyTransition(
  action: TransitionAction,
  from: ReportStatus,
  role: Role | null,
): { to: ReportStatus; event: string } {
  const rule = TRANSITIONS[action];

  if (!rule) {
    throw new TransitionError(`Unknown action: ${String(action)}`);
  }

  if (!role || !rule.roles.includes(role)) {
    throw new TransitionError(
      `A ${role ?? "signed-out visitor"} cannot ${action.toLowerCase()} a report.`,
    );
  }

  if (!rule.from.includes(from)) {
    throw new TransitionError(
      isTerminal(from)
        ? `This report is already ${from.toLowerCase()}.`
        : `Cannot ${action.toLowerCase()} a report that is ${from.toLowerCase()}.`,
    );
  }

  return { to: rule.to, event: rule.event };
}

/** Which actions a given role may take on a report in a given state. */
export function availableActions(
  from: ReportStatus,
  role: Role | null,
): TransitionAction[] {
  return (Object.keys(TRANSITIONS) as TransitionAction[]).filter((action) =>
    canTransition(action, from, role),
  );
}

/** Trust and points consequences. Only accounts can be charged or credited. */
export const TRUST_ON_VERIFY = 2;
export const TRUST_ON_REJECT = -10;
export const POINTS_ON_VERIFY = 10;
export const POINTS_ON_RESOLVE = 5;
