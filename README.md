# Project Pulse

Project Pulse is a mobile-first Node.js dashboard for project managers. It reads a Google Sheets portfolio and turns it into a clear view of project health, task progress, blockers, overdue work, risks, milestones, and a per-project Gantt timeline.

It is designed for a PM who needs answers quickly:

- Which projects are genuinely healthy, at risk, or off track?
- What work is overdue or blocked, and who owns it?
- Which milestone needs a decision or escalation next?
- Is each project progressing at the pace required by its target date?

## Core capabilities

- Google OAuth connection to your own Google Sheets, with a Jira-style Kanban board that updates only a task's workflow-status cell when you move it.
- Smart header matching for common names such as `Project Name`, `Project`, `Task Name`, `Summary`, `Assignee`, `% Complete`, and `Due Date`.
- Portfolio health derived from project health fields, overdue/blocked work, due-date pressure, and high/critical risks.
- Searchable task viewer, drag-and-drop Kanban board (with a touch-friendly Move to control), project cards, analytics, attention list, milestone tracking, and responsive Gantt charts.
- Clean empty state until you connect and import a Google Sheet; the app never displays sample tasks as your work.
- Stateless encrypted session cookies; it does not persist a copy of your Sheet data on the server.

## Recommended Google Sheet structure

Create one spreadsheet with these tabs. The names may vary, but the column headings are important.

### Projects (recommended)

| Project ID | Project Name | Owner | Sponsor | Status | Health | Priority | Start Date | Due Date | Progress | Budget | Actual Cost |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PRJ-001 | TRC Digital Portal | Ali Abu Ras | Digital Services | In Progress | At Risk | High | 2026-05-04 | 2026-09-15 | 62% | 185000 | 112000 |

### Tasks (required for work analytics and Gantt)

| Task ID | Project ID | Task Name | Owner | Status | Priority | Start Date | Due Date | Progress | Effort Hours | Dependency | Labels |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T-101 | PRJ-001 | Complete UAT regression cycle | Huda | In Progress | High | 2026-07-01 | 2026-07-22 | 68% | 48 | Gateway sign-off | UAT, Release |

### Risks (optional)

| Risk ID | Project ID | Risk Title | Owner | Risk Level | Status | Due Date |
|---|---|---|---|---|---|---|
| R-001 | PRJ-001 | Gateway vendor response may delay UAT | Fadi | High | Open | 2026-07-15 |

### Milestones (optional)

| Milestone ID | Project ID | Milestone Name | Owner | Status | Due Date |
|---|---|---|---|---|---|
| M-001 | PRJ-001 | Release readiness review | Ali Abu Ras | At Risk | 2026-07-24 |

Use ISO dates (`YYYY-MM-DD`) where possible. Dates such as `DD/MM/YYYY` and percentage values such as `68%` are also understood.

## Health rules

If your Projects tab includes `Health`, Project Pulse uses it. Otherwise it calculates health as follows:

1. Complete when the project is closed/complete or its progress is 100%.
2. Off track when it contains an overdue task or a blocked task.
3. At risk when it has an open High/Critical risk, or it is due within 14 days and is below 80% complete.
4. On track in every other case.

These are intentionally transparent defaults. They are easy to refine later into organization-specific governance rules.

## Run locally

```bash
cp .env.example .env
npm ci
npm run dev
```

Open `http://localhost:5173` during local development. The Vite development server proxies API requests to the Node.js server at port `3000`.

```bash
npm test
npm run build
npm start
```

The production server listens on `PORT` (default `3000`) and serves the built React app plus the API.

## Connect Google Sheets

1. In Google Cloud Console, create or select a project.
2. Configure the OAuth consent screen as an External app, add yourself as a test user while it is in testing, then create an **OAuth client ID** of type **Web application**.
3. Add this Authorized redirect URI locally: `http://localhost:3000/api/auth/google/callback`.
4. Add the deployed Render URL after deployment: `https://YOUR-SERVICE.onrender.com/api/auth/google/callback`.
5. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SESSION_PASSWORD`, and `APP_URL` in `.env` locally or Render Environment variables.

The integration requests `spreadsheets` access, Drive metadata read-only (to list spreadsheets), and the Google account email used for the connection. Dragging a task changes only the mapped workflow-status cell (for example, `Status (DEV)`) in that spreadsheet. Reconnect Google after upgrading from an older read-only version so it can grant this permission.

## Deploy on Render

This repository includes `render.yaml`.

1. Push this project to GitHub.
2. In Render, select **New → Blueprint** and choose the repository. Render will read `render.yaml`.
3. Create the service, then set `APP_URL` to the final Render URL, for example `https://project-pulse.onrender.com`.
4. Add the Google OAuth variables from above. Keep `GOOGLE_CLIENT_SECRET` and `SESSION_PASSWORD` secret.
5. Add the final Render callback URL to the OAuth client in Google Cloud, then redeploy.

The Blueprint defaults to Render's free plan so it does not assume a paid service. Change `plan: free` to your preferred instance type if you need an always-on service.

## Architecture

```text
Google Sheets → Google OAuth → Node/Express API → Smart parser + portfolio metrics → React dashboard + Kanban status updates
```

- **Server:** Node.js, Express 5, TypeScript, Google APIs, Zod validation, Helmet, rate limiting.
- **Client:** React, Vite, responsive CSS, Recharts loaded only when the dashboard chart is viewed.
- **Persistence:** no server-side portfolio database. The most recently imported portfolio is cached only in the signed-in browser, while live Sheets remain the source of truth.

## Quality checks

`npm run lint`, `npm test`, and `npm run build` all run in CI on pushes and pull requests.
