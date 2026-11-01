export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Invite links expire; plain read-only shares do not. */
export function tokenExpiry(resourceType: string, now: number = Date.now()): Date | null {
  return resourceType.endsWith("-invite") ? new Date(now + INVITE_TTL_MS) : null;
}
