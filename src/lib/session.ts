import {
  SessionEnvelopeSchema,
  SessionSnapshotSchema,
  type SessionSnapshot,
} from "./contracts.ts";

export const SESSION_STORAGE_KEY = "comic-if-line:v1";

export function serializeSession(input: unknown): string | null {
  const snapshot = SessionSnapshotSchema.safeParse(input);
  if (!snapshot.success) return null;

  return JSON.stringify({
    version: SESSION_STORAGE_KEY,
    snapshot: snapshot.data,
  });
}

export function restoreSession(
  serialized: string | null | undefined,
): SessionSnapshot | null {
  if (!serialized) return null;

  try {
    const envelope = SessionEnvelopeSchema.safeParse(JSON.parse(serialized));
    return envelope.success ? envelope.data.snapshot : null;
  } catch {
    return null;
  }
}

export function readSession(): SessionSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    return restoreSession(window.sessionStorage.getItem(SESSION_STORAGE_KEY));
  } catch {
    return null;
  }
}

export function writeSession(input: unknown): boolean {
  if (typeof window === "undefined") return false;

  const serialized = serializeSession(input);
  if (!serialized) return false;

  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, serialized);
    return true;
  } catch {
    return false;
  }
}

export function clearSession(): boolean {
  if (typeof window === "undefined") return false;

  try {
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
