import crypto from "crypto";

const SECRET = process.env.NEXTAUTH_SECRET;
if (!SECRET) {
  throw new Error("NEXTAUTH_SECRET environment variable is required");
}

const TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutes — just long enough for headless rendering

interface PreviewTokenPayload {
  reportId: string;
  exp: number;
}

function sign(data: string): string {
  return crypto.createHmac("sha256", SECRET as string).update(data).digest("base64url");
}

/** Produces a short-lived, tamper-proof token granting render-only access to a single report. */
export function signPreviewToken(reportId: string): string {
  const payload: PreviewTokenPayload = { reportId, exp: Date.now() + TOKEN_TTL_MS };
  const json = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${json}.${sign(json)}`;
}

/** Verifies a preview token and returns the reportId it grants access to, or null if invalid/expired. */
export function verifyPreviewToken(token: string, reportId: string): boolean {
  const [json, signature] = token.split(".");
  if (!json || !signature) return false;
  if (sign(json) !== signature) return false;

  try {
    const payload = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as PreviewTokenPayload;
    return payload.reportId === reportId && Date.now() < payload.exp;
  } catch {
    return false;
  }
}
