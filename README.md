# Project Pulse

Project Pulse is a mobile-first dashboard for project managers. It reads a Google Sheet directly in the browser and turns it into a clear view of project health, task progress, blockers, overdue work, risks, milestones, and a per-project Gantt timeline.

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
- No backend server and no copy of your Sheet is stored by the application; Google access stays in the browser session.

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
npm ci
npm run dev
```

Open `http://localhost:5173` during local development.

```bash
npm test
npm run build
```

The production build is a static GitHub Pages site.

## Connect Google Sheets

1. In Google Cloud Console, create or select a project.
2. Configure the OAuth consent screen as an External app and add yourself as a test user while it is in testing.
3. In **Clients**, add this Authorized JavaScript origin: `https://aliaburas80.github.io`.
4. Enable both **Google Sheets API** and **Google Drive API** for the project.

The integration requests `spreadsheets` access, Drive metadata read-only (to list spreadsheets), and the Google account email used for the connection. Dragging a task changes only the mapped workflow-status cell (for example, `Status (DEV)`) in that spreadsheet.

## Deploy on GitHub Pages

The GitHub Actions workflow deploys every push to `main`.

In the repository, open **Settings → Pages** and select **GitHub Actions** as the build source. The site will then be available at `https://aliaburas80.github.io/project-pulse/`.

## Architecture

```text
Google Sheets → Google OAuth in the browser → Smart parser + portfolio metrics → React dashboard + Kanban status updates
```

- **Client:** React, Vite, browser-based Google Identity Services, responsive CSS, Recharts loaded only when the dashboard chart is viewed.
- **Persistence:** the most recently imported portfolio is cached only in the browser, while live Sheets remain the source of truth.

## Quality checks

`npm run lint`, `npm test`, and `npm run build` all run in CI on pushes and pull requests.
