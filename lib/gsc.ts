import { google } from "googleapis";
import { prisma } from "./db";
import { decryptJSON } from "./encryption";

interface GscCredentials {
  access_token: string;
  refresh_token: string;
  expiry_date?: number;
}

function getOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/integrations/gsc/callback`
  );
}

export async function getGscClient(projectId: string) {
  const integration = await prisma.integration.findFirst({
    where: { projectId, type: "gsc" },
  });
  if (!integration?.credentials) throw new Error("GSC not connected");

  const creds = decryptJSON<GscCredentials>(integration.credentials);
  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(creds);
  return oauth2Client;
}

export function getGscAuthUrl(projectId: string) {
  const oauth2Client = getOAuth2Client();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/webmasters.readonly"],
    state: projectId,
    prompt: "consent",
  });
}

export async function fetchGscData(
  projectId: string,
  siteUrl: string,
  dateFrom: string,
  dateTo: string
) {
  const auth = await getGscClient(projectId);
  const sc = google.searchconsole({ version: "v1", auth });

  const [rowsResp, pagesResp, queriesResp] = await Promise.all([
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateFrom,
        endDate: dateTo,
        dimensions: [],
      },
    }),
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateFrom,
        endDate: dateTo,
        dimensions: ["page"],
        rowLimit: 10,
      },
    }),
    sc.searchanalytics.query({
      siteUrl,
      requestBody: {
        startDate: dateFrom,
        endDate: dateTo,
        dimensions: ["query"],
        rowLimit: 10,
      },
    }),
  ]);

  const totals = rowsResp.data.rows?.[0];
  const topPages = (pagesResp.data.rows || []).map((r) => ({
    url: r.keys![0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));
  const topQueries = (queriesResp.data.rows || []).map((r) => ({
    query: r.keys![0],
    clicks: r.clicks || 0,
    impressions: r.impressions || 0,
    ctr: r.ctr || 0,
    position: r.position || 0,
  }));

  return {
    clicks: totals?.clicks || 0,
    impressions: totals?.impressions || 0,
    ctr: totals?.ctr || 0,
    avgPosition: totals?.position || 0,
    topPages,
    topQueries,
  };
}
