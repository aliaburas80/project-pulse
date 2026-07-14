import { google } from "googleapis";
import type { Request, Response } from "express";
import { session } from "./session.js";

const scopes = [
  "https://www.googleapis.com/auth/spreadsheets",
  "https://www.googleapis.com/auth/drive.metadata.readonly",
  "https://www.googleapis.com/auth/userinfo.email"
];

function getAppUrl(req?: Request): string {
  const configured = process.env.APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (req) return `${req.protocol}://${req.get("host")}`;
  return "http://localhost:3000";
}

export function googleIsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function createOAuthClient(req?: Request) {
  if (!googleIsConfigured()) throw new Error("Google OAuth is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.");
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getAppUrl(req)}/api/auth/google/callback`
  );
}

export async function getGoogleClient(req: Request, res: Response) {
  const currentSession = await session(req, res);
  if (!currentSession.googleTokens) return undefined;
  const client = createOAuthClient(req);
  client.setCredentials(currentSession.googleTokens);
  client.on("tokens", async (tokens) => {
    currentSession.googleTokens = { ...currentSession.googleTokens, ...tokens };
    await currentSession.save();
  });
  return client;
}

export async function beginGoogleAuthorization(req: Request, res: Response): Promise<string> {
  const client = createOAuthClient(req);
  const currentSession = await session(req, res);
  const oauthState = crypto.randomUUID();
  currentSession.oauthState = oauthState;
  await currentSession.save();
  return client.generateAuthUrl({ access_type: "offline", prompt: "consent", scope: scopes, state: oauthState, include_granted_scopes: true });
}

export async function finishGoogleAuthorization(req: Request, res: Response, code: string, returnedState?: string) {
  const currentSession = await session(req, res);
  if (!returnedState || returnedState !== currentSession.oauthState) throw new Error("The Google authorization state did not match. Please try connecting again.");
  const client = createOAuthClient(req);
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = await oauth2.userinfo.get();
  currentSession.googleTokens = tokens;
  currentSession.googleEmail = profile.data.email ?? undefined;
  currentSession.oauthState = undefined;
  await currentSession.save();
}

export async function disconnectGoogle(req: Request, res: Response) {
  const currentSession = await session(req, res);
  currentSession.googleTokens = undefined;
  currentSession.googleEmail = undefined;
  currentSession.oauthState = undefined;
  await currentSession.save();
}
