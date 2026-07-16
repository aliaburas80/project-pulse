import { getPortfolioMetrics, parseSheets } from "../../server/portfolio";
import type { ActivityEvent, PortfolioData, PortfolioMetrics, Session, SheetFile } from "./types";

export interface TaskStatusUpdate {
  spreadsheetId: string;
  sheetTitle: string;
  rowNumber: number;
  statusColumn: number;
  workflowStatus: string;
}

export interface ActivityEventInput {
  spreadsheetId: string;
  taskId?: string;
  taskTitle: string;
  owner?: string;
  statusField: string;
  fromStatus?: string;
  toStatus: string;
  sourceSheet?: string;
}

type GoogleTokenResponse = { access_token?: string; expires_in?: number; error?: string; error_description?: string };
type GoogleTokenClient = { requestAccessToken: (options?: { prompt?: "" | "consent" }) => void };

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: { client_id: string; scope: string; callback: (response: GoogleTokenResponse) => void }) => GoogleTokenClient;
        };
      };
    };
  }
}

// OAuth client IDs identify the app publicly; they are safe to include in a browser-only deployment.
const clientId = "1048383690442-gvustjokcqe3vrhj5hhganikeg8t2er9.apps.googleusercontent.com";
const activitySheetTitle = "Project Pulse Activity";
const scopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/userinfo.email"
].join(" ");

let accessToken: string | null = null;
let tokenExpiresAt = 0;
let connectedEmail: string | null = null;
let identityScript: Promise<void> | null = null;

function loadIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (identityScript) return identityScript;
  identityScript = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => window.google?.accounts?.oauth2 ? resolve() : reject(new Error("Google Sign-In did not load."));
    script.onerror = () => reject(new Error("Google Sign-In could not be loaded."));
    document.head.append(script);
  });
  return identityScript;
}

async function requestAccessToken(prompt: "" | "consent"): Promise<string> {
  if (!clientId) throw new Error("Google Client ID is missing from this deployment.");
  await loadIdentityScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) throw new Error("Google Sign-In is not available. Please try again.");
  return new Promise((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes,
      callback: (response) => {
        if (!response.access_token) {
          reject(new Error(response.error_description ?? response.error ?? "Google did not grant access."));
          return;
        }
        accessToken = response.access_token;
        tokenExpiresAt = Date.now() + Math.max(60, response.expires_in ?? 3600) * 1000;
        resolve(response.access_token);
      }
    });
    client.requestAccessToken({ prompt });
  });
}

async function token(interactive = false): Promise<string> {
  if (accessToken && tokenExpiresAt > Date.now() + 30_000) return accessToken;
  if (!interactive) throw new Error("Your Google connection has expired. Connect Google Sheets again.");
  return requestAccessToken("consent");
}

async function googleFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await token()}`, "Content-Type": "application/json", ...init?.headers }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: { message?: string }; error_description?: string };
    throw new Error(body.error?.message ?? body.error_description ?? `Google request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

function columnName(column: number) {
  let result = "";
  let value = column;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
}

function extractSpreadsheetId(input: string) {
  const matched = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return matched?.[1] ?? input.trim();
}

function activityRange(cellRange: string) {
  return `'${activitySheetTitle}'!${cellRange}`;
}

async function ensureActivityLog(spreadsheetId: string): Promise<void> {
  const metadata = await googleFetch<{ sheets?: { properties?: { title?: string } }[] }>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties(title)`);
  const alreadyExists = (metadata.sheets ?? []).some((sheet) => sheet.properties?.title === activitySheetTitle);
  if (alreadyExists) return;
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: activitySheetTitle } } }] })
  });
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(activityRange("A1:H1"))}?valueInputOption=USER_ENTERED`, {
    method: "PUT",
    body: JSON.stringify({ values: [["Event Timestamp", "Task ID", "Task", "Owner", "Status Field", "From Status", "To Status", "Source Sheet"]] })
  });
}

async function recordActivity(event: ActivityEventInput): Promise<ActivityEvent> {
  await ensureActivityLog(event.spreadsheetId);
  const timestamp = new Date().toISOString();
  await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(event.spreadsheetId)}/values/${encodeURIComponent(activityRange("A:H"))}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    body: JSON.stringify({ values: [[timestamp, event.taskId ?? "", event.taskTitle, event.owner ?? "", event.statusField, event.fromStatus ?? "", event.toStatus, event.sourceSheet ?? ""]] })
  });
  return { timestamp, taskId: event.taskId, taskTitle: event.taskTitle, owner: event.owner, statusField: event.statusField, fromStatus: event.fromStatus, toStatus: event.toStatus, sourceSheet: event.sourceSheet };
}

async function importSheet(spreadsheetIdOrUrl: string): Promise<{ data: PortfolioData; metrics: PortfolioMetrics }> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetIdOrUrl);
  const metadata = await googleFetch<{ properties?: { title?: string }; sheets?: { properties?: { title?: string; sheetType?: string } }[] }>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?includeGridData=false&fields=properties(title),sheets.properties(title,sheetType)`);
  const titles = (metadata.sheets ?? [])
    .filter((sheet) => sheet.properties?.sheetType === "GRID")
    .map((sheet) => sheet.properties?.title)
    .filter((title): title is string => Boolean(title));
  const params = new URLSearchParams();
  titles.forEach((title) => params.append("ranges", `'${title.replace(/'/g, "''")}'!A:ZZ`));
  params.set("majorDimension", "ROWS");
  const content = await googleFetch<{ valueRanges?: { values?: unknown[][] }[] }>(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchGet?${params}`);
  const rawSheets = (content.valueRanges ?? []).map((range, index) => ({ title: titles[index] ?? `Sheet ${index + 1}`, values: range.values ?? [] }));
  const data = parseSheets(rawSheets, metadata.properties?.title ?? "Google Sheet", spreadsheetId);
  return { data, metrics: getPortfolioMetrics(data) };
}

export const api = {
  session: async (): Promise<Session> => ({ googleConfigured: Boolean(clientId), connected: Boolean(accessToken), email: connectedEmail }),
  connect: async (): Promise<Session> => {
    await requestAccessToken("consent");
    const profile = await googleFetch<{ email?: string }>("https://www.googleapis.com/oauth2/v2/userinfo");
    connectedEmail = profile.email ?? null;
    return { googleConfigured: Boolean(clientId), connected: true, email: connectedEmail };
  },
  sheets: async (): Promise<{ files: SheetFile[] }> => {
    const params = new URLSearchParams({
      q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      pageSize: "100",
      orderBy: "modifiedTime desc",
      fields: "files(id,name,modifiedTime,webViewLink)"
    });
    const data = await googleFetch<{ files?: SheetFile[] }>(`https://www.googleapis.com/drive/v3/files?${params}`);
    return { files: data.files ?? [] };
  },
  importSheet,
  updateTaskStatus: async (update: TaskStatusUpdate): Promise<{ status: "updated"; workflowStatus: string }> => {
    const range = `'${update.sheetTitle.replace(/'/g, "''")}'!${columnName(update.statusColumn)}${update.rowNumber}`;
    await googleFetch(`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(update.spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: "PUT",
      body: JSON.stringify({ values: [[update.workflowStatus]] })
    });
    return { status: "updated", workflowStatus: update.workflowStatus };
  },
  startActivityTracking: async (spreadsheetId: string): Promise<void> => ensureActivityLog(spreadsheetId),
  recordActivity,
  disconnect: async (): Promise<void> => {
    accessToken = null;
    tokenExpiresAt = 0;
    connectedEmail = null;
  }
};
