import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is required");
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface OAuthStatePayload {
  projectId: string;
  userId: string;
  ts: number;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET as string).update(data).digest("base64url");
}

/** Produces a signed, tamper-proof OAuth `state` value binding a project to the initiating user. */
export function signOAuthState(projectId: string, userId: string): string {
  const payload: OAuthStatePayload = { projectId, userId, ts: Date.now() };
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(json);
  return `${json}.${signature}`;
}

/** Verifies the signature and expiry of a `state` value, returning its payload or null. */
export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const [json, signature] = state.split(".");
  if (!json || !signature) return null;
  if (sign(json) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as OAuthStatePayload;
    if (Date.now() - payload.ts > STATE_TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
