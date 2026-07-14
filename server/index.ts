import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { google } from "googleapis";
import { z } from "zod";
import { beginGoogleAuthorization, disconnectGoogle, finishGoogleAuthorization, getGoogleClient, googleIsConfigured } from "./google.js";
import { getPortfolioMetrics, parseSheets } from "./portfolio.js";
import { session, sessionIsSafe } from "./session.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT ?? 3000);

if (process.env.NODE_ENV === "production" && !sessionIsSafe()) {
  throw new Error("SESSION_PASSWORD must be at least 32 characters in production.");
}

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false }));
app.use(express.json({ limit: "200kb" }));
app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 180, standardHeaders: "draft-8", legacyHeaders: false }));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "project-pulse", time: new Date().toISOString() }));

app.get("/api/session", async (req, res, next) => {
  try {
    const currentSession = await session(req, res);
    res.json({ googleConfigured: googleIsConfigured(), connected: Boolean(currentSession.googleTokens), email: currentSession.googleEmail ?? null });
  } catch (error) { next(error); }
});

app.get("/api/auth/google", async (req, res, next) => {
  try {
    if (!googleIsConfigured()) return res.status(503).json({ error: "Google OAuth has not been configured on this deployment." });
    return res.redirect(await beginGoogleAuthorization(req, res));
  } catch (error) { return next(error); }
});

app.get("/api/auth/google/callback", async (req, res, next) => {
  try {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!code) return res.redirect("/?connection=failed");
    await finishGoogleAuthorization(req, res, code, state);
    return res.redirect("/?connection=success");
  } catch (error) { return next(error); }
});

app.post("/api/auth/google/disconnect", async (req, res, next) => {
  try {
    await disconnectGoogle(req, res);
    res.status(204).end();
  } catch (error) { next(error); }
});

app.get("/api/google/spreadsheets", async (req, res, next) => {
  try {
    const auth = await getGoogleClient(req, res);
    if (!auth) return res.status(401).json({ error: "Connect Google first." });
    const drive = google.drive({ version: "v3", auth });
    const result = await drive.files.list({
      q: "mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false",
      pageSize: 100,
      orderBy: "modifiedTime desc",
      fields: "files(id,name,modifiedTime,webViewLink)"
    });
    res.json({ files: result.data.files ?? [] });
  } catch (error) { next(error); }
});

const importSchema = z.object({ spreadsheetId: z.string().min(10).max(200) });
app.post("/api/google/import", async (req, res, next) => {
  try {
    const body = importSchema.parse(req.body);
    const auth = await getGoogleClient(req, res);
    if (!auth) return res.status(401).json({ error: "Connect Google first." });
    const sheets = google.sheets({ version: "v4", auth });
    const metadata = await sheets.spreadsheets.get({ spreadsheetId: body.spreadsheetId, includeGridData: false, fields: "properties(title),sheets.properties(title,sheetType)" });
    const titles = (metadata.data.sheets ?? []).filter((sheet) => sheet.properties?.sheetType === "GRID").map((sheet) => sheet.properties?.title).filter((title): title is string => Boolean(title));
    const quote = (title: string) => `'${title.replace(/'/g, "''")}'!A:ZZ`;
    const content = await sheets.spreadsheets.values.batchGet({ spreadsheetId: body.spreadsheetId, ranges: titles.map(quote), majorDimension: "ROWS" });
    const rawSheets = (content.data.valueRanges ?? []).map((range, index) => ({ title: titles[index] ?? `Sheet ${index + 1}`, values: (range.values ?? []) as unknown[][] }));
    const data = parseSheets(rawSheets, metadata.data.properties?.title ?? "Google Sheet", body.spreadsheetId);
    res.json({ data, metrics: getPortfolioMetrics(data) });
  } catch (error) { next(error); }
});

const updateTaskStatusSchema = z.object({
  spreadsheetId: z.string().min(10).max(200),
  sheetTitle: z.string().min(1).max(150),
  rowNumber: z.number().int().min(2).max(200000),
  statusColumn: z.number().int().min(1).max(702),
  workflowStatus: z.string().trim().min(1).max(100)
});

const columnName = (column: number) => {
  let result = "";
  let value = column;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    value = Math.floor((value - 1) / 26);
  }
  return result;
};

app.post("/api/google/task-status", async (req, res, next) => {
  try {
    const body = updateTaskStatusSchema.parse(req.body);
    const auth = await getGoogleClient(req, res);
    if (!auth) return res.status(401).json({ error: "Reconnect Google Sheets before moving tasks." });
    const sheets = google.sheets({ version: "v4", auth });
    const escapedTitle = body.sheetTitle.replace(/'/g, "''");
    const range = `'${escapedTitle}'!${columnName(body.statusColumn)}${body.rowNumber}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: body.spreadsheetId,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[body.workflowStatus]] }
    });
    res.json({ status: "updated", workflowStatus: body.workflowStatus });
  } catch (error) { next(error); }
});

if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.resolve(__dirname, "../dist/client"), { maxAge: "1h", etag: true }));
  app.get("/{*splat}", (_req, res) => res.sendFile(path.resolve(__dirname, "../dist/client/index.html")));
}

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  const status = error instanceof z.ZodError ? 400 : 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: message });
});

app.listen(port, () => console.log(`Project Pulse is running on port ${port}`));
