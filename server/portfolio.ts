import type { Health, Milestone, PortfolioData, PortfolioMetrics, Project, ProjectMetrics, Risk, Task, TaskStatus } from "./types.js";

type SheetRows = { title: string; values: unknown[][] }[];
type Row = Record<string, unknown>;

const aliases = {
  projectId: ["project id", "project key", "project code"],
  projectName: ["project name", "project", "name", "project title"],
  taskId: ["task id", "issue key", "work item id", "id", "key"],
  riskId: ["risk id", "id", "key"],
  milestoneId: ["milestone id", "id", "key"],
  taskTitle: ["task name", "task", "task title", "summary", "title", "work item"],
  owner: ["owner", "assignee", "responsible", "task owner", "project manager", "pm"],
  sponsor: ["sponsor", "business owner", "executive sponsor"],
  status: ["status dev", "status", "state", "phase"],
  health: ["health", "rag", "project health", "health status"],
  priority: ["priority", "importance"],
  startDate: ["start date", "start", "planned start", "start date planned"],
  dueDate: ["due date", "due", "end date", "target date", "finish", "planned finish", "deadline"],
  completedDate: ["completed date", "completion date", "done date", "actual finish", "closed date"],
  progress: ["progress", "% complete", "percent complete", "completion", "complete %", "completion %"],
  budget: ["budget", "planned budget", "budget amount"],
  actualCost: ["actual cost", "spent", "actual", "cost to date"],
  notes: ["notes", "comment", "comments", "description"],
  effort: ["effort", "effort hours", "estimate", "estimated hours", "hours"],
  dependency: ["dependency", "dependencies", "blocked by", "depends on"],
  labels: ["labels", "tags", "category", "categories"],
  riskLevel: ["risk level", "level", "severity", "impact"],
  riskTitle: ["risk", "risk title", "title", "description"],
  milestone: ["milestone", "milestone name", "title", "name"]
} as const;

function normaliseHeader(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getField(row: Row, field: keyof typeof aliases): unknown {
  const headers = aliases[field];
  for (const header of headers) {
    if (header in row && row[header] !== undefined && row[header] !== "") return row[header];
  }
  return undefined;
}

function asText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  const text = String(value).trim();
  return text || undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const raw = asText(value);
  if (!raw) return undefined;
  const parsed = Number(raw.replace(/[,$\s]/g, "").replace("%", ""));
  if (!Number.isFinite(parsed)) return undefined;
  return raw.includes("%") ? parsed : parsed;
}

function asProgress(value: unknown): number | undefined {
  const number = asNumber(value);
  if (number === undefined) return undefined;
  return Math.max(0, Math.min(100, number <= 1 ? number * 100 : number));
}

function asDate(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number" && value > 20000 && value < 100000) {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const slash = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (slash) {
    const [, day, month, year] = slash;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString().slice(0, 10);
}

function asHealth(value: unknown): Health | undefined {
  const text = normaliseHeader(value);
  if (!text) return undefined;
  if (/complete|closed|done/.test(text)) return "complete";
  if (/off track|red|critical|delayed/.test(text)) return "off_track";
  if (/at risk|amber|yellow|watch/.test(text)) return "at_risk";
  if (/on track|green|healthy/.test(text)) return "on_track";
  return undefined;
}

function asTaskStatus(value: unknown): TaskStatus {
  const text = normaliseHeader(value);
  if (/done|complete|closed|resolved|finished/.test(text)) return "done";
  if (/block|imped|hold/.test(text)) return "blocked";
  if (/cancel|wont do|won't do/.test(text)) return "cancelled";
  if (/progress|active|review|testing|ready/.test(text)) return "in_progress";
  return "not_started";
}

function asRiskLevel(value: unknown): Risk["level"] {
  const text = normaliseHeader(value);
  if (["low", "medium", "high", "critical"].includes(text)) return text as NonNullable<Risk["level"]>;
  return undefined;
}

function toRows(values: unknown[][], sheetTitle: string): Row[] {
  const aliasHeaders = new Set<string>(Object.values(aliases).flat());
  const headerIndex = values.slice(0, 50)
    .map((record, index) => ({
      index,
      score: record.map(normaliseHeader).filter((header) => aliasHeaders.has(header)).length
    }))
    .reduce((best, candidate) => candidate.score > best.score ? candidate : best, { index: 0, score: 0 }).index;
  const headerRow = values[headerIndex];
  const records = values.slice(headerIndex + 1);
  if (!headerRow?.length) return [];
  const headers = headerRow.map(normaliseHeader);
  const developmentStatusColumn = headers.includes("status dev") ? headers.indexOf("status dev") + 1 : undefined;
  const deliveryStatusColumn = headers.includes("status") ? headers.indexOf("status") + 1 : undefined;
  return records
    .map((record, index) => ({ record, rowNumber: index + headerIndex + 2 }))
    .filter(({ record }) => record.some((cell) => asText(cell)))
    .map(({ record, rowNumber }) => ({
      ...Object.fromEntries(headers.map((header, index) => [header, record[index]])),
      __sheetTitle: sheetTitle,
      __rowNumber: rowNumber,
      __developmentStatusColumn: developmentStatusColumn,
      __deliveryStatusColumn: deliveryStatusColumn
    }));
}

function classifySheet(title: string, rows: Row[]): "projects" | "tasks" | "risks" | "milestones" | "unknown" {
  const normalizedTitle = normaliseHeader(title);
  const sampleHeaders = Object.keys(rows[0] ?? {});
  const has = (...names: string[]) => names.some((name) => sampleHeaders.includes(name));
  if (/risk|raid/.test(normalizedTitle) || has("risk level", "severity")) return "risks";
  if (/milestone|deliverable/.test(normalizedTitle)) return "milestones";
  if (/task|work item|issues|backlog|activities/.test(normalizedTitle) || has("task name", "task", "assignee", "issue key")) return "tasks";
  if (/project|portfolio|programme|program/.test(normalizedTitle) || has("project name", "sponsor", "project health")) return "projects";
  return "unknown";
}

const rowKey = (row: Row, field: keyof typeof aliases, fallback: string) => asText(getField(row, field)) ?? fallback;

export function parseSheets(sheets: SheetRows, spreadsheetName?: string, spreadsheetId?: string): PortfolioData {
  const buckets = { projects: [] as Row[], tasks: [] as Row[], risks: [] as Row[], milestones: [] as Row[] };
  const notes: string[] = [];

  for (const sheet of sheets) {
    const rows = toRows(sheet.values, sheet.title);
    if (!rows.length) continue;
    const kind = classifySheet(sheet.title, rows);
    if (kind === "unknown") {
      notes.push(`Skipped “${sheet.title}” because its columns do not match Projects, Tasks, Risks, or Milestones.`);
    } else {
      buckets[kind].push(...rows);
      notes.push(`Read ${rows.length} row${rows.length === 1 ? "" : "s"} from “${sheet.title}” as ${kind}.`);
    }
  }

  const projects: Project[] = buckets.projects.map((row, index) => ({
    id: rowKey(row, "projectId", `PRJ-${index + 1}`),
    name: rowKey(row, "projectName", `Untitled project ${index + 1}`),
    owner: asText(getField(row, "owner")),
    sponsor: asText(getField(row, "sponsor")),
    status: asText(getField(row, "status")),
    health: asHealth(getField(row, "health")),
    priority: asText(getField(row, "priority")),
    startDate: asDate(getField(row, "startDate")),
    dueDate: asDate(getField(row, "dueDate")),
    progress: asProgress(getField(row, "progress")),
    budget: asNumber(getField(row, "budget")),
    actualCost: asNumber(getField(row, "actualCost")),
    notes: asText(getField(row, "notes"))
  }));

  const projectByName = new Map(projects.map((project) => [project.name.toLowerCase(), project.id]));
  const tasks: Task[] = buckets.tasks.map((row, index) => {
    const suppliedProject = asText(getField(row, "projectId"));
    const suppliedProjectName = asText(getField(row, "projectName"));
    const projectId = suppliedProject
      ?? (suppliedProjectName ? projectByName.get(suppliedProjectName.toLowerCase()) : undefined)
      ?? "IMPORTED_WORK";
    const developmentStatus = asText(row["status dev"]);
    const deliveryStatus = asText(row.status);
    const effectiveStatus = deliveryStatus ?? developmentStatus;
    return {
      id: rowKey(row, "taskId", `TASK-${index + 1}`),
      projectId,
      projectName: suppliedProjectName ?? spreadsheetName ?? "Imported work",
      title: rowKey(row, "taskTitle", `Untitled task ${index + 1}`),
      owner: asText(getField(row, "owner")),
      status: asTaskStatus(effectiveStatus),
      priority: asText(getField(row, "priority")),
      startDate: asDate(getField(row, "startDate")),
      dueDate: asDate(getField(row, "dueDate")),
      completedDate: asDate(getField(row, "completedDate")),
      progress: asProgress(getField(row, "progress")),
      effortHours: asNumber(getField(row, "effort")),
      dependency: asText(getField(row, "dependency")),
      labels: asText(getField(row, "labels"))?.split(/[,;|]/).map((label) => label.trim()).filter(Boolean),
      notes: asText(getField(row, "notes")),
      developmentStatus,
      deliveryStatus,
      workflowStatus: developmentStatus ?? deliveryStatus ?? "Not set",
      source: typeof row.__sheetTitle === "string" && typeof row.__rowNumber === "number"
        && (typeof row.__developmentStatusColumn === "number" || typeof row.__deliveryStatusColumn === "number")
        ? {
            sheetTitle: row.__sheetTitle,
            rowNumber: row.__rowNumber,
            developmentStatusColumn: typeof row.__developmentStatusColumn === "number" ? row.__developmentStatusColumn : undefined,
            deliveryStatusColumn: typeof row.__deliveryStatusColumn === "number" ? row.__deliveryStatusColumn : undefined
          }
        : undefined
    };
  });

  const inferredProjects = new Map<string, Project>();
  for (const task of tasks) {
    if (task.projectId === "UNASSIGNED") continue;
    if (!projects.some((project) => project.id === task.projectId) && !inferredProjects.has(task.projectId)) {
      inferredProjects.set(task.projectId, { id: task.projectId, name: task.projectName ?? task.projectId, status: "Imported from tasks" });
    }
  }
  projects.push(...inferredProjects.values());

  const risks: Risk[] = buckets.risks.map((row, index) => ({
    id: rowKey(row, "riskId", `RISK-${index + 1}`),
    projectId: asText(getField(row, "projectId")) ?? (asText(getField(row, "projectName")) ? projectByName.get(asText(getField(row, "projectName"))!.toLowerCase()) : undefined),
    title: rowKey(row, "riskTitle", `Untitled risk ${index + 1}`),
    owner: asText(getField(row, "owner")),
    level: asRiskLevel(getField(row, "riskLevel")),
    status: asText(getField(row, "status")),
    dueDate: asDate(getField(row, "dueDate"))
  }));

  const milestones: Milestone[] = buckets.milestones.map((row, index) => ({
    id: rowKey(row, "milestoneId", `MILESTONE-${index + 1}`),
    projectId: asText(getField(row, "projectId")) ?? (asText(getField(row, "projectName")) ? projectByName.get(asText(getField(row, "projectName"))!.toLowerCase()) : undefined) ?? "UNASSIGNED",
    title: rowKey(row, "milestone", `Untitled milestone ${index + 1}`),
    dueDate: asDate(getField(row, "dueDate")),
    status: asText(getField(row, "status")),
    owner: asText(getField(row, "owner"))
  }));

  if (!projects.length && tasks.length) notes.push("No Projects sheet was found, so projects were inferred from task project values.");
  if (!projects.length && !tasks.length) notes.push("No usable project data was found. Check that your header row contains names such as Project Name, Task Name, Status, Start Date, and Due Date.");

  return { projects, tasks, risks, milestones, source: "google_sheets", importedAt: new Date().toISOString(), spreadsheetName, spreadsheetId, mappingNotes: notes };
}

export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  return Math.ceil((end - start) / 86400000);
}

export function isOverdue(task: Task, today = new Date().toISOString().slice(0, 10)): boolean {
  return Boolean(task.dueDate && task.dueDate < today && !["done", "cancelled"].includes(task.status));
}

function taskProgress(task: Task): number {
  if (task.progress !== undefined) return task.progress;
  if (task.status === "done") return 100;
  if (task.status === "in_progress") return 50;
  return 0;
}

function calculateHealth(project: Project, tasks: Task[], risks: Risk[], today: string): Health {
  if (project.health) return project.health;
  if ((project.progress ?? 0) >= 100 || /complete|closed/.test(project.status?.toLowerCase() ?? "")) return "complete";
  if (tasks.some((task) => task.status === "blocked") || tasks.some((task) => isOverdue(task, today))) return "off_track";
  if (risks.some((risk) => ["high", "critical"].includes(risk.level ?? "") && !/closed|resolved/.test(risk.status ?? ""))) return "at_risk";
  if (project.dueDate && daysBetween(today, project.dueDate) <= 14 && (project.progress ?? 0) < 80) return "at_risk";
  return "on_track";
}

export function getPortfolioMetrics(data: PortfolioData, today = new Date().toISOString().slice(0, 10)): PortfolioMetrics {
  const projectMetrics: ProjectMetrics[] = data.projects.map((project) => {
    const tasks = data.tasks.filter((task) => task.projectId === project.id);
    const risks = data.risks.filter((risk) => risk.projectId === project.id && !/closed|resolved/i.test(risk.status ?? ""));
    const progress = project.progress ?? (tasks.length ? Math.round(tasks.reduce((sum, task) => sum + taskProgress(task), 0) / tasks.length) : 0);
    const complete = tasks.filter((task) => task.status === "done").length;
    const overdue = tasks.filter((task) => isOverdue(task, today)).length;
    const health = calculateHealth({ ...project, progress }, tasks, risks, today);
    return {
      ...project,
      progress,
      health,
      totalTasks: tasks.length,
      completedTasks: complete,
      inProgressTasks: tasks.filter((task) => task.status === "in_progress").length,
      overdueTasks: overdue,
      openRisks: risks.length,
      daysRemaining: project.dueDate ? daysBetween(today, project.dueDate) : undefined,
      costVariance: project.budget !== undefined && project.actualCost !== undefined ? project.actualCost - project.budget : undefined
    };
  });

  const countHealth = (health: Health) => projectMetrics.filter((project) => project.health === health).length;
  const taskCount = (status: TaskStatus) => data.tasks.filter((task) => task.status === status).length;
  const taskStatusBreakdown = [
    { name: "Done", value: taskCount("done"), color: "#16a34a" },
    { name: "In progress", value: taskCount("in_progress"), color: "#2563eb" },
    { name: "Blocked", value: taskCount("blocked"), color: "#dc2626" },
    { name: "Not started", value: taskCount("not_started"), color: "#94a3b8" }
  ].filter((entry) => entry.value > 0);
  const priorities = new Map<string, number>();
  data.tasks.forEach((task) => priorities.set(task.priority ?? "Unspecified", (priorities.get(task.priority ?? "Unspecified") ?? 0) + 1));
  const nameFor = (id?: string) => projectMetrics.find((project) => project.id === id)?.name;
  const attentionItems = [
    ...data.tasks.filter((task) => isOverdue(task, today)).map((task) => ({ type: "overdue" as const, title: task.title, projectName: nameFor(task.projectId), detail: `Overdue since ${task.dueDate}` })),
    ...data.tasks.filter((task) => task.status === "blocked").map((task) => ({ type: "blocked" as const, title: task.title, projectName: nameFor(task.projectId), detail: task.dependency ? `Waiting for ${task.dependency}` : "Marked as blocked" })),
    ...data.risks.filter((risk) => ["high", "critical"].includes(risk.level ?? "") && !/closed|resolved/i.test(risk.status ?? "")).map((risk) => ({ type: "risk" as const, title: risk.title, projectName: nameFor(risk.projectId), detail: `${risk.level} risk · ${risk.status ?? "Open"}` }))
  ].slice(0, 12);

  return {
    totalProjects: projectMetrics.length,
    onTrackProjects: countHealth("on_track"),
    atRiskProjects: countHealth("at_risk"),
    offTrackProjects: countHealth("off_track"),
    completeProjects: countHealth("complete"),
    totalTasks: data.tasks.length,
    completedTasks: taskCount("done"),
    overdueTasks: data.tasks.filter((task) => isOverdue(task, today)).length,
    blockedTasks: taskCount("blocked"),
    completionRate: data.tasks.length ? Math.round((taskCount("done") / data.tasks.length) * 100) : 0,
    projectMetrics,
    taskStatusBreakdown,
    priorityBreakdown: [...priorities].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    upcomingMilestones: [...data.milestones].filter((milestone) => milestone.dueDate && milestone.dueDate >= today).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")).slice(0, 8),
    attentionItems
  };
}
