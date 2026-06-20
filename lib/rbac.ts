import type { Session } from "next-auth";

export type Role = "admin" | "manager" | "worker";

/** Returns true if the session user's role is one of the allowed roles. */
export function hasRole(session: Session | null, allowed: Role[]): boolean {
  const role = session?.user?.role as Role | undefined;
  return !!role && allowed.includes(role);
}
