import { lazy, Suspense, useEffect, useMemo, useState, type DragEvent } from "react";
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, CircleAlert, Clipboard, Clock3, ExternalLink, FolderKanban, LayoutDashboard, ListTodo, LoaderCircle, Menu, MoreHorizontal, RefreshCw, ShieldAlert, Sheet, Sparkles, Target, Unplug, X } from "lucide-react";
import { api } from "./api";
import type { Health, PortfolioData, PortfolioMetrics, ProjectMetrics, Session, SheetFile, Task } from "./types";

const StatusChart = lazy(() => import("./StatusChart"));

type View = "dashboard" | "projects" | "gantt" | "work";
type PortfolioState = { data: PortfolioData; metrics: PortfolioMetrics };

const cacheKey = "project-pulse-portfolio-v2";
const today = new Date().toISOString().slice(0, 10);
const healthLabel: Record<Health, string> = { on_track: "On track", at_risk: "At risk", off_track: "Off track", complete: "Complete" };
const statusLabel: Record<Task["status"], string> = { not_started: "Not started", in_progress: "In progress", blocked: "Blocked", done: "Done", cancelled: "Cancelled" };
const emptyPortfolio: PortfolioState = {
  data: { projects: [], tasks: [], risks: [], milestones: [], source: "empty", importedAt: new Date().toISOString(), mappingNotes: [] },
  metrics: { totalProjects: 0, onTrackProjects: 0, atRiskProjects: 0, offTrackProjects: 0, completeProjects: 0, totalTasks: 0, completedTasks: 0, overdueTasks: 0, blockedTasks: 0, completionRate: 0, projectMetrics: [], taskStatusBreakdown: [], priorityBreakdown: [], upcomingMilestones: [], attentionItems: [] }
};

function formatDate(date?: string) {
  return date ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(new Date(`${date}T12:00:00`)) : "—";
}

function formatShortDate(date?: string) {
  return date ? new Intl.DateTimeFormat("en", { day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`)) : "—";
}

function daysTo(date?: string) {
  if (!date) return undefined;
  return Math.ceil((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000);
}

function App() {
  const [portfolio, setPortfolio] = useState<PortfolioState | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [showConnect, setShowConnect] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const bootstrap = async () => {
      try {
        const initialSession = await api.session();
        setSession(initialSession);
        const cached = window.localStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached) as PortfolioState;
          setPortfolio(parsed);
        } else {
          setPortfolio(emptyPortfolio);
        }
        const query = new URLSearchParams(window.location.search).get("connection");
        if (query === "success") setNotice("Google Sheets is connected. Choose a spreadsheet to load your portfolio.");
        if (query === "failed") setNotice("Google connection was not completed. Please try again.");
        window.history.replaceState({}, "", window.location.pathname);
      } catch (error) {
        setNotice(error instanceof Error ? error.message : "Unable to load the dashboard.");
      }
    };
    void bootstrap();
  }, []);

  const updatePortfolio = (next: PortfolioState) => {
    persistPortfolio(next);
    setNotice(next.data.source === "google_sheets" ? `Loaded ${next.data.spreadsheetName ?? "Google Sheet"}.` : null);
  };

  const persistPortfolio = (next: PortfolioState) => {
    setPortfolio(next);
    window.localStorage.setItem(cacheKey, JSON.stringify(next));
  };

  if (!portfolio || !session) return <LoadingScreen />;

  const navigation: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "dashboard", label: "Portfolio", icon: LayoutDashboard },
    { id: "projects", label: "Projects", icon: FolderKanban },
    { id: "gantt", label: "Gantt", icon: CalendarDays },
    { id: "work", label: "Work", icon: ListTodo }
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Brand />
        <nav className="nav-list" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => <button className={`nav-item ${view === id ? "active" : ""}`} key={id} onClick={() => setView(id)}><Icon size={19} /><span>{label}</span></button>)}
        </nav>
        <div className="sidebar-bottom">
          <div className="source-summary"><span className={`source-dot ${portfolio.data.source}`} /> <span>{portfolio.data.source === "google_sheets" ? "Live Google Sheet" : "No sheet loaded"}</span></div>
          <button className="help-card" onClick={() => setShowConnect(true)}><Sheet size={19} /><span><strong>Connect your data</strong><small>Read your Google Sheets</small></span><ChevronRight size={16} /></button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Open navigation" onClick={() => setMenuOpen(!menuOpen)}><Menu size={22} /></button>
          <div className="breadcrumbs"><span>Project Pulse</span><ChevronRight size={15} /><strong>{navigation.find((item) => item.id === view)?.label}</strong></div>
          <div className="topbar-actions">
            <button className="button secondary hide-small" onClick={() => setShowConnect(true)}><Sheet size={17} />{session.connected ? "Change sheet" : "Connect Sheets"}</button>
            <button className="button primary" onClick={() => setShowConnect(true)}><Sparkles size={17} />Sync portfolio</button>
          </div>
        </header>
        {menuOpen && <MobileNav items={navigation} active={view} onSelect={(next) => { setView(next); setMenuOpen(false); }} />}
        {notice && <div className="notice"><CircleAlert size={18} /><span>{notice}</span><button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button></div>}

        {view === "dashboard" && <Dashboard state={portfolio} onOpenConnect={() => setShowConnect(true)} onViewProjects={() => setView("projects")} />}
        {view === "projects" && <ProjectsView state={portfolio} onSelectGantt={() => setView("gantt")} />}
        {view === "gantt" && <GanttView state={portfolio} />}
        {view === "work" && <WorkView state={portfolio} onStateChange={persistPortfolio} onOpenConnect={() => setShowConnect(true)} />}
      </main>

      {showConnect && <ConnectModal session={session} state={portfolio} onClose={() => setShowConnect(false)} onSession={setSession} onImport={(next) => { updatePortfolio(next); setShowConnect(false); }} />}
    </div>
  );
}

function Brand() {
  return <div className="brand"><span className="brand-mark"><Target size={21} /></span><span><strong>Project Pulse</strong><small>Portfolio command center</small></span></div>;
}

function LoadingScreen() {
  return <div className="loading-screen"><span className="brand-mark"><Target size={22} /></span><strong>Project Pulse</strong><LoaderCircle className="spin" size={22} /></div>;
}

function MobileNav({ items, active, onSelect }: { items: { id: View; label: string; icon: typeof LayoutDashboard }[]; active: View; onSelect: (view: View) => void }) {
  return <nav className="mobile-nav">{items.map(({ id, label, icon: Icon }) => <button key={id} className={active === id ? "active" : ""} onClick={() => onSelect(id)}><Icon size={18} />{label}</button>)}</nav>;
}

function Dashboard({ state, onOpenConnect, onViewProjects }: { state: PortfolioState; onOpenConnect: () => void; onViewProjects: () => void }) {
  const { data, metrics } = state;
  if (data.source === "empty") return <EmptyPortfolioState onOpenConnect={onOpenConnect} />;
  return <div className="page-content">
    <section className="page-heading"><div><p className="eyebrow">Portfolio health</p><h1>Know where to focus today.</h1><p>One view of delivery progress, blockers, risks, milestones, and schedule health.</p></div><button className="button secondary" onClick={onOpenConnect}><RefreshCw size={16} />Refresh data</button></section>
    <section className="metric-grid">
      <MetricCard icon={<FolderKanban />} label="Portfolio health" value={`${metrics.onTrackProjects}/${metrics.totalProjects}`} help="projects on track" trend={metrics.atRiskProjects ? `${metrics.atRiskProjects} at risk` : "All projects healthy"} tone={metrics.atRiskProjects ? "amber" : "green"} />
      <MetricCard icon={<Target />} label="Task completion" value={`${metrics.completionRate}%`} help={`${metrics.completedTasks} of ${metrics.totalTasks} tasks completed`} trend={`${metrics.totalTasks - metrics.completedTasks} still open`} tone="blue" />
      <MetricCard icon={<Clock3 />} label="Overdue work" value={String(metrics.overdueTasks)} help="tasks need an update" trend={metrics.overdueTasks ? "Review delivery dates" : "Nothing overdue"} tone={metrics.overdueTasks ? "red" : "green"} />
      <MetricCard icon={<ShieldAlert />} label="Active blockers" value={String(metrics.blockedTasks)} help="work items are blocked" trend={metrics.blockedTasks ? "Remove impediments" : "No blockers reported"} tone={metrics.blockedTasks ? "red" : "green"} />
    </section>
    <section className="dashboard-grid">
      <div className="panel portfolio-panel"><PanelHeading title="Project portfolio" subtitle="Health, progress, delivery date and open work" action="View all" onAction={onViewProjects} />
        <div className="responsive-table"><table><thead><tr><th>Project</th><th>Health</th><th>Progress</th><th>Open work</th><th>Due</th></tr></thead><tbody>{metrics.projectMetrics.slice(0, 6).map((project) => <tr key={project.id}><td><strong>{project.name}</strong><small>{project.owner ?? "No owner assigned"}</small></td><td><HealthPill health={project.health} /></td><td><Progress value={project.progress} compact /></td><td><span className={project.overdueTasks ? "text-red" : ""}>{project.totalTasks - project.completedTasks} open{project.overdueTasks ? ` · ${project.overdueTasks} overdue` : ""}</span></td><td><strong className={project.daysRemaining !== undefined && project.daysRemaining < 0 ? "text-red" : ""}>{formatShortDate(project.dueDate)}</strong></td></tr>)}</tbody></table></div>
      </div>
      <div className="panel status-panel"><PanelHeading title="Work status" subtitle="Across every active project" /><div className="chart-wrap"><Suspense fallback={<div className="chart-loading">Loading chart…</div>}><StatusChart data={metrics.taskStatusBreakdown} /></Suspense></div><div className="chart-summary"><strong>{metrics.totalTasks}</strong><span>tracked work items</span></div></div>
      <div className="panel attention-panel"><PanelHeading title="Needs your attention" subtitle="Issues that can affect delivery" /><AttentionList items={metrics.attentionItems} /></div>
      <div className="panel milestones-panel"><PanelHeading title="Upcoming milestones" subtitle="Next key commitments" /><MilestoneList items={metrics.upcomingMilestones} projects={metrics.projectMetrics} /></div>
    </section>
    {data.mappingNotes.length > 0 && <section className="mapping-note"><Sheet size={18} /><div><strong>Import summary</strong><p>{data.mappingNotes.join(" ")}</p></div></section>}
  </div>;
}

function MetricCard({ icon, label, value, help, trend, tone }: { icon: React.ReactNode; label: string; value: string; help: string; trend: string; tone: "blue" | "green" | "amber" | "red" }) {
  return <article className={`metric-card ${tone}`}><div className="metric-icon">{icon}</div><p>{label}</p><strong>{value}</strong><span>{help}</span><small>{trend}</small></article>;
}

function PanelHeading({ title, subtitle, action, onAction }: { title: string; subtitle: string; action?: string; onAction?: () => void }) {
  return <div className="panel-heading"><div><h2>{title}</h2><p>{subtitle}</p></div>{action && <button className="text-button" onClick={onAction}>{action}<ChevronRight size={15} /></button>}</div>;
}

function HealthPill({ health }: { health: Health }) { return <span className={`pill health-${health}`}>{healthLabel[health]}</span>; }
function TaskPill({ status, label }: { status: Task["status"]; label?: string }) { return <span className={`pill task-${status}`}>{label ?? statusLabel[status]}</span>; }
function Progress({ value, compact = false }: { value: number; compact?: boolean }) { return <div className={`progress ${compact ? "compact" : ""}`}><div><span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div><strong>{Math.round(value)}%</strong></div>; }

function AttentionList({ items }: { items: PortfolioMetrics["attentionItems"] }) {
  if (!items.length) return <EmptyState icon={<CheckCircle2 />} title="Nothing needs escalation" description="No overdue work, blockers, or high risks were found." />;
  return <div className="attention-list">{items.map((item, index) => <div className="attention-item" key={`${item.type}-${index}`}><span className={`attention-icon ${item.type}`}>{item.type === "overdue" ? <Clock3 size={17} /> : item.type === "blocked" ? <AlertTriangle size={17} /> : <ShieldAlert size={17} />}</span><div><strong>{item.title}</strong><small>{item.projectName ? `${item.projectName} · ` : ""}{item.detail}</small></div><MoreHorizontal size={18} /></div>)}</div>;
}

function MilestoneList({ items, projects }: { items: PortfolioMetrics["upcomingMilestones"]; projects: ProjectMetrics[] }) {
  if (!items.length) return <EmptyState icon={<CalendarDays />} title="No upcoming milestones" description="Add a Milestones sheet or include milestone dates in your portfolio." />;
  const projectName = (id: string) => projects.find((project) => project.id === id)?.name ?? id;
  return <div className="milestone-list">{items.map((milestone) => { const remaining = daysTo(milestone.dueDate); return <div className="milestone-item" key={milestone.id}><div className="date-chip"><strong>{new Date(`${milestone.dueDate}T12:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(`${milestone.dueDate}T12:00:00`))}</span></div><div><strong>{milestone.title}</strong><small>{projectName(milestone.projectId)} · {milestone.owner ?? "No owner"}</small></div><span className={remaining !== undefined && remaining <= 7 ? "soon" : ""}>{remaining === 0 ? "Today" : `${remaining}d`}</span></div>; })}</div>;
}

function EmptyState({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) { return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{description}</p></div>; }

function EmptyPortfolioState({ onOpenConnect }: { onOpenConnect: () => void }) {
  return <div className="page-content empty-portfolio-page">
    <section className="page-heading"><div><p className="eyebrow">Your workspace</p><h1>Start with your real project data.</h1><p>No sample tasks are shown. Import a Google Sheet when you are ready.</p></div></section>
    <section className="empty-import panel"><span><Sheet size={29} /></span><div><h2>Paste your Google Sheet link</h2><p>Choose <strong>Connect Google Sheets</strong>, approve access, then paste your Sheet URL and select <strong>Import</strong>. Project Pulse reads the selected worksheet and keeps your Sheet as the source of truth.</p><button className="button primary" onClick={onOpenConnect}><Sheet size={17} />Connect Google Sheets</button></div></section>
  </div>;
}

function ProjectsView({ state, onSelectGantt }: { state: PortfolioState; onSelectGantt: () => void }) {
  const { metrics } = state;
  const [filter, setFilter] = useState<"all" | Health>("all");
  const projects = filter === "all" ? metrics.projectMetrics : metrics.projectMetrics.filter((project) => project.health === filter);
  return <div className="page-content"><section className="page-heading"><div><p className="eyebrow">Delivery portfolio</p><h1>Projects with context, not noise.</h1><p>Use health, progress, schedule and work signals to lead the right conversation.</p></div><button className="button secondary" onClick={onSelectGantt}><CalendarDays size={17} />Open Gantt</button></section>
    <div className="filter-row"><FilterButton active={filter === "all"} onClick={() => setFilter("all")}>All <span>{metrics.totalProjects}</span></FilterButton><FilterButton active={filter === "on_track"} onClick={() => setFilter("on_track")}>On track <span>{metrics.onTrackProjects}</span></FilterButton><FilterButton active={filter === "at_risk"} onClick={() => setFilter("at_risk")}>At risk <span>{metrics.atRiskProjects}</span></FilterButton><FilterButton active={filter === "off_track"} onClick={() => setFilter("off_track")}>Off track <span>{metrics.offTrackProjects}</span></FilterButton></div>
    <section className="project-grid">{projects.map((project) => <ProjectCard key={project.id} project={project} />)}</section>
  </div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <button className={`filter-button ${active ? "active" : ""}`} onClick={onClick}>{children}</button>; }

function ProjectCard({ project }: { project: ProjectMetrics }) {
  const deadline = project.daysRemaining;
  return <article className="project-card"><div className="project-card-top"><span className="project-avatar">{project.name.slice(0, 1)}</span><HealthPill health={project.health} /></div><h2>{project.name}</h2><p>{project.owner ?? "No project owner assigned"}</p><Progress value={project.progress} /><div className="project-card-info"><div><span>Timeline</span><strong className={deadline !== undefined && deadline < 0 ? "text-red" : ""}>{deadline === undefined ? "No date" : deadline < 0 ? `${Math.abs(deadline)}d overdue` : `${deadline}d remaining`}</strong></div><div><span>Work</span><strong>{project.completedTasks}/{project.totalTasks} done</strong></div><div><span>Risks</span><strong className={project.openRisks ? "text-amber" : ""}>{project.openRisks} open</strong></div></div><footer><span>{formatDate(project.startDate)} — {formatDate(project.dueDate)}</span><button aria-label={`Open ${project.name}`}><ChevronRight size={18} /></button></footer></article>;
}

function GanttView({ state }: { state: PortfolioState }) {
  const [projectId, setProjectId] = useState(state.metrics.projectMetrics[0]?.id ?? "");
  const project = state.metrics.projectMetrics.find((item) => item.id === projectId);
  const tasks = state.data.tasks.filter((task) => task.projectId === projectId && (task.startDate || task.dueDate));
  const dates = [project?.startDate, project?.dueDate, ...tasks.flatMap((task) => [task.startDate, task.dueDate])].filter((date): date is string => Boolean(date));
  const start = dates.length ? new Date(`${dates.sort()[0]}T00:00:00`) : new Date();
  start.setDate(start.getDate() - (start.getDay() || 7) + 1);
  const latest = dates.length ? new Date(`${dates.sort().at(-1)}T00:00:00`) : new Date();
  const weeks = Math.max(8, Math.min(24, Math.ceil((latest.getTime() - start.getTime()) / 604800000) + 3));
  const weekDates = Array.from({ length: weeks }, (_, index) => { const date = new Date(start); date.setDate(date.getDate() + index * 7); return date; });
  const position = (date?: string) => date ? Math.max(0, Math.min(weeks - 1, Math.floor((new Date(`${date}T00:00:00`).getTime() - start.getTime()) / 604800000))) : 0;
  return <div className="page-content"><section className="page-heading"><div><p className="eyebrow">Delivery timeline</p><h1>Plan meets real execution.</h1><p>See the schedule, dependencies, and work that needs a recovery action.</p></div></section>
    <div className="gantt-toolbar"><label>Project<select value={projectId} onChange={(event) => setProjectId(event.target.value)}>{state.metrics.projectMetrics.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div><HealthPill health={project?.health ?? "on_track"} /><span>{project?.progress ?? 0}% complete</span></div></div>
    {!tasks.length ? <div className="panel"><EmptyState icon={<CalendarDays />} title="No scheduled tasks" description="Add Start Date and Due Date columns in the Tasks sheet to create a Gantt timeline." /></div> : <section className="gantt-panel"><div className="gantt-grid" style={{ gridTemplateColumns: `minmax(235px, 1.6fr) repeat(${weeks}, minmax(82px, 1fr))` }}><div className="gantt-task-header">Work item</div>{weekDates.map((week) => <div className="gantt-week" key={week.toISOString()}>{formatShortDate(week.toISOString().slice(0, 10))}</div>)}{tasks.map((task) => { const taskStart = position(task.startDate ?? task.dueDate); const taskEnd = position(task.dueDate ?? task.startDate); const span = Math.max(1, taskEnd - taskStart + 1); return <GanttRow key={task.id} task={task} startColumn={taskStart + 2} span={span} weeks={weeks} />; })}</div></section>}
  </div>;
}

function GanttRow({ task, startColumn, span, weeks }: { task: Task; startColumn: number; span: number; weeks: number }) {
  return <><div className="gantt-task"><strong>{task.title}</strong><small>{task.owner ?? "Unassigned"} · {formatShortDate(task.startDate)} — {formatShortDate(task.dueDate)}</small></div>{Array.from({ length: weeks }, (_, index) => <div className="gantt-cell" key={index} />)}<div className={`gantt-bar ${task.status}`} style={{ gridColumn: `${startColumn} / span ${span}` }} title={`${task.title}: ${statusLabel[task.status]}`}><span>{task.progress ?? (task.status === "done" ? 100 : task.status === "in_progress" ? 50 : 0)}%</span></div></>;
}

function workflowToTaskStatus(workflowStatus: string): Task["status"] {
  const text = workflowStatus.toLowerCase();
  if (/done|complete|closed|resolved|finished/.test(text)) return "done";
  if (/block|imped|hold/.test(text)) return "blocked";
  if (/cancel|wont do|won't do/.test(text)) return "cancelled";
  if (/progress|active|review|testing|ready/.test(text)) return "in_progress";
  return "not_started";
}

type BoardStatusField = "development" | "delivery";

const boardStatusLabel: Record<BoardStatusField, string> = {
  development: "Development status",
  delivery: "Task status"
};

function taskWorkflowStatus(task: Task, field: BoardStatusField) {
  const status = field === "development"
    ? task.developmentStatus ?? task.workflowStatus
    : task.deliveryStatus ?? task.workflowStatus;
  return status?.trim() || "Not set";
}

function hasStatusField(task: Task, field: BoardStatusField) {
  if (field === "development") {
    return task.developmentStatus !== undefined || task.source?.developmentStatusColumn !== undefined || task.source?.statusColumn !== undefined;
  }
  return task.deliveryStatus !== undefined || task.source?.deliveryStatusColumn !== undefined;
}

function statusColumnFor(task: Task, field: BoardStatusField) {
  return field === "development"
    ? task.source?.developmentStatusColumn ?? task.source?.statusColumn
    : task.source?.deliveryStatusColumn;
}

function workflowColumnOrder(status: string) {
  const value = status.toLowerCase().replace(/[\s_-]+/g, " ").trim();
  if (value === "not set") return 90;
  if (/backlog|pending|not started/.test(value)) return 10;
  if (/to do|todo|ready to start/.test(value)) return 20;
  if (/progress|development|developing|in dev|active/.test(value)) return 30;
  if (/ready.*test|qa ready|review/.test(value)) return 40;
  if (/testing|qa/.test(value)) return 50;
  if (/done|complete|closed|resolved|finished/.test(value)) return 60;
  if (/cancel|wont do|won't do/.test(value)) return 70;
  return 80;
}

function workflowColumnTone(status: string) {
  const value = status.toLowerCase();
  if (/done|complete|closed|resolved|finished/.test(value)) return "complete";
  if (/ready.*test|testing|qa|review/.test(value)) return "test";
  if (/progress|development|developing|active/.test(value)) return "active";
  if (/pending|backlog|not started/.test(value)) return "pending";
  return "neutral";
}

function priorityTone(priority?: string) {
  const value = priority?.toLowerCase() ?? "";
  if (/very high|critical|urgent/.test(value)) return "critical";
  if (/high/.test(value)) return "high";
  if (/medium/.test(value)) return "medium";
  if (/low/.test(value)) return "low";
  return "neutral";
}

function PriorityPill({ priority }: { priority?: string }) {
  return <span className={`priority-pill priority-${priorityTone(priority)}`}>{priority ?? "No priority"}</span>;
}

function WorkView({ state, onStateChange, onOpenConnect }: { state: PortfolioState; onStateChange: (state: PortfolioState) => void; onOpenConnect: () => void }) {
  const [query, setQuery] = useState("");
  const [boardField, setBoardField] = useState<BoardStatusField>("development");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [mode, setMode] = useState<"list" | "board">("board");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [syncingTaskId, setSyncingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const projectNames = useMemo(() => new Map(state.metrics.projectMetrics.map((project) => [project.id, project.name])), [state.metrics.projectMetrics]);
  const availableBoardFields = useMemo(() => (Object.keys(boardStatusLabel) as BoardStatusField[])
    .filter((field) => state.data.tasks.some((task) => hasStatusField(task, field))), [state.data.tasks]);
  const activeBoardField = availableBoardFields.includes(boardField) ? boardField : availableBoardFields[0] ?? "development";
  const filtered = useMemo(() => state.data.tasks.filter((task) => {
    const workflowStatus = taskWorkflowStatus(task, activeBoardField);
    const searchable = [task.title, task.owner, task.priority, task.notes, task.developmentStatus, task.deliveryStatus, projectNames.get(task.projectId)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return (workflowFilter === "all" || workflowStatus === workflowFilter) && searchable.includes(query.trim().toLowerCase());
  }), [state.data.tasks, activeBoardField, workflowFilter, query, projectNames]);
  const boardColumns = useMemo(() => {
    return [...new Set(state.data.tasks.map((task) => taskWorkflowStatus(task, activeBoardField)))]
      .sort((left, right) => {
        return workflowColumnOrder(left) - workflowColumnOrder(right) || left.localeCompare(right);
      });
  }, [state.data.tasks, activeBoardField]);
  const selectedTask = selectedTaskId ? state.data.tasks.find((task) => task.id === selectedTaskId) ?? null : null;

  if (state.data.source === "empty") return <EmptyPortfolioState onOpenConnect={onOpenConnect} />;

  const moveTask = async (task: Task, workflowStatus: string): Promise<boolean> => {
    const statusColumn = statusColumnFor(task, activeBoardField);
    if (taskWorkflowStatus(task, activeBoardField) === workflowStatus || syncingTaskId) return false;
    if (workflowStatus === "Not set") return false;
    if (state.data.source !== "google_sheets" || !state.data.spreadsheetId || !task.source || !statusColumn) {
      setError("Connect and import a Google Sheet before moving tasks.");
      return false;
    }
    setError(null);
    setSyncingTaskId(task.id);
    const optimistic: PortfolioState = {
      ...state,
      data: {
        ...state.data,
        tasks: state.data.tasks.map((item) => {
          if (item.id !== task.id) return item;
          const developmentStatus = activeBoardField === "development" ? workflowStatus : item.developmentStatus;
          const deliveryStatus = activeBoardField === "delivery" ? workflowStatus : item.deliveryStatus;
          const effectiveStatus = deliveryStatus ?? developmentStatus ?? workflowStatus;
          return { ...item, developmentStatus, deliveryStatus, workflowStatus: developmentStatus ?? deliveryStatus ?? "Not set", status: workflowToTaskStatus(effectiveStatus) };
        })
      }
    };
    onStateChange(optimistic);
    try {
      await api.updateTaskStatus({ spreadsheetId: state.data.spreadsheetId, sheetTitle: task.source.sheetTitle, rowNumber: task.source.rowNumber, statusColumn, workflowStatus });
      const refreshed = await api.importSheet(state.data.spreadsheetId);
      onStateChange(refreshed);
      return true;
    } catch (reason) {
      onStateChange(state);
      setError(reason instanceof Error ? reason.message : "The status could not be saved to Google Sheets.");
      return false;
    } finally {
      setSyncingTaskId(null);
      setDraggedTaskId(null);
    }
  };

  const onTaskDragStart = (event: DragEvent<HTMLElement>, taskId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", taskId);
    setDraggedTaskId(taskId);
  };

  return <div className="page-content delivery-desk">
    <section className="delivery-desk-heading"><div className="desk-title"><span className="pulse-mark" aria-hidden="true"><i /><i /><i /></span><div><p className="eyebrow">Project Pulse / Workroom</p><h1>Make the next move count.</h1><p>Open a card for the complete brief. Move it when the work has real momentum.</p></div></div><div className="desk-live"><span><i />Live sheet</span><strong>{filtered.length}</strong><small>cards in focus</small></div></section>
    <div className="task-toolbar">
      <div className="work-filters">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search task, owner, priority, notes, or project…" aria-label="Search tasks" />
        {availableBoardFields.length > 1 && <select value={activeBoardField} onChange={(event) => { setBoardField(event.target.value as BoardStatusField); setWorkflowFilter("all"); }} aria-label="Choose status column">{availableBoardFields.map((field) => <option key={field} value={field}>{boardStatusLabel[field]}</option>)}</select>}
        <select value={workflowFilter} onChange={(event) => setWorkflowFilter(event.target.value)} aria-label="Filter by workflow status"><option value="all">All sheet statuses</option>{boardColumns.map((column) => <option key={column} value={column}>{column}</option>)}</select>
      </div>
      <div className="view-switch" aria-label="Task view"><button className={mode === "board" ? "active" : ""} onClick={() => setMode("board")}>Board</button><button className={mode === "list" ? "active" : ""} onClick={() => setMode("list")}>List</button></div>
    </div>
    {error && <div className="error-message task-error"><AlertTriangle size={17} />{error}</div>}
    {mode === "board" ? <section className="kanban-board">{boardColumns.map((column) => {
      const tasks = filtered.filter((task) => taskWorkflowStatus(task, activeBoardField) === column);
      const totalInColumn = state.data.tasks.filter((task) => taskWorkflowStatus(task, activeBoardField) === column).length;
      const canReceiveTasks = column !== "Not set";
      const tone = workflowColumnTone(column);
      return <div className={`kanban-column delivery-column tone-${tone} ${draggedTaskId && canReceiveTasks ? "drag-active" : ""}`} key={column} onDragOver={(event) => { if (canReceiveTasks) event.preventDefault(); }} onDrop={(event) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData("text/plain");
        const task = state.data.tasks.find((item) => item.id === taskId);
        if (task && canReceiveTasks) void moveTask(task, column);
      }}>
        <header><div><i aria-hidden="true" /><strong>{column}</strong><span title={`${totalInColumn} task${totalInColumn === 1 ? "" : "s"} in this status`}>{tasks.length}</span></div><MoreHorizontal size={18} /></header>
        <div className="kanban-cards">{tasks.map((task) => <article className={`kanban-card tone-${tone} ${draggedTaskId === task.id ? "dragging" : ""}`} key={task.id} draggable={syncingTaskId !== task.id} onDragStart={(event) => onTaskDragStart(event, task.id)} onDragEnd={() => setDraggedTaskId(null)} onClick={() => !draggedTaskId && setSelectedTaskId(task.id)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && !draggedTaskId) { event.preventDefault(); setSelectedTaskId(task.id); } }} tabIndex={0} role="button" aria-label={`Open details for ${task.title}`}>
          <div className="kanban-card-top"><PriorityPill priority={task.priority} /><span>{syncingTaskId === task.id ? <LoaderCircle className="spin" size={15} /> : task.owner?.split(/\s|&/).filter(Boolean).slice(0, 2).map((name) => name[0]).join("") || "?"}</span></div>
          <h3 dir="auto">{task.title}</h3>{task.notes && <p dir="auto">{task.notes}</p>}
          <footer><span>{task.owner ?? "Unassigned"}</span>{task.dueDate && <span className={task.dueDate < today && task.status !== "done" ? "text-red" : ""}>{formatShortDate(task.dueDate)}</span>}</footer>
          <label className="kanban-move" onClick={(event) => event.stopPropagation()}>Move to<select value={taskWorkflowStatus(task, activeBoardField)} onPointerDown={(event) => event.stopPropagation()} onChange={(event) => void moveTask(task, event.target.value)} disabled={Boolean(syncingTaskId)}>{boardColumns.map((option) => <option value={option} key={option} disabled={option === "Not set"}>{option}</option>)}</select></label>
        </article>)}{!tasks.length && <div className="kanban-empty">{canReceiveTasks ? "Drop task here" : "Tasks without a status"}</div>}</div>
      </div>;
    })}</section> : <div className="panel"><div className="responsive-table"><table className="work-table"><thead><tr><th>Work item</th><th>Project</th><th>Owner</th><th>DEV status</th><th>Task status</th><th>Due date</th><th>Progress</th></tr></thead><tbody>{filtered.map((task) => <tr key={task.id} onClick={() => setSelectedTaskId(task.id)} className="work-row"><td><strong dir="auto">{task.title}</strong><small>{task.priority ?? "Normal"} priority{task.dependency ? ` · Depends on ${task.dependency}` : ""}</small></td><td>{projectNames.get(task.projectId) ?? task.projectName ?? "—"}</td><td>{task.owner ?? "—"}</td><td><TaskPill status={workflowToTaskStatus(task.developmentStatus ?? "")} label={task.developmentStatus ?? "—"} /></td><td><TaskPill status={workflowToTaskStatus(task.deliveryStatus ?? "")} label={task.deliveryStatus ?? "—"} /></td><td><span className={task.dueDate && task.dueDate < today && !["done", "cancelled"].includes(task.status) ? "text-red" : ""}>{formatDate(task.dueDate)}</span></td><td><Progress value={task.progress ?? (task.status === "done" ? 100 : task.status === "in_progress" ? 50 : 0)} compact /></td></tr>)}</tbody></table></div>{!filtered.length && <EmptyState icon={<ListTodo />} title="No work items found" description="Change your filter or search term." />}</div>}
    {selectedTask && <TaskDetailDialog key={`${selectedTask.id}-${activeBoardField}`} task={selectedTask} boardField={activeBoardField} boardColumns={boardColumns} spreadsheetId={state.data.spreadsheetId} isSaving={syncingTaskId === selectedTask.id} onClose={() => setSelectedTaskId(null)} onMove={moveTask} />}
  </div>;
}

function TaskDetailDialog({ task, boardField, boardColumns, spreadsheetId, isSaving, onClose, onMove }: {
  task: Task;
  boardField: BoardStatusField;
  boardColumns: string[];
  spreadsheetId?: string;
  isSaving: boolean;
  onClose: () => void;
  onMove: (task: Task, status: string) => Promise<boolean>;
}) {
  const currentStatus = taskWorkflowStatus(task, boardField);
  const moveOptions = currentStatus === "Not set" ? ["Not set", ...boardColumns.filter((status) => status !== "Not set")] : boardColumns.filter((status) => status !== "Not set");
  const [nextStatus, setNextStatus] = useState(currentStatus);
  const [copied, setCopied] = useState(false);
  const sourceUrl = spreadsheetId ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit` : undefined;

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  const copyDetails = async () => {
    const text = [
      task.title,
      `Priority: ${task.priority ?? "Not set"}`,
      `Owner: ${task.owner ?? "Unassigned"}`,
      `Development status: ${task.developmentStatus ?? "Not set"}`,
      `Task status: ${task.deliveryStatus ?? "Not set"}`,
      task.notes
    ].filter(Boolean).join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return <div className="task-detail-backdrop" role="presentation"><section className={`task-detail-panel tone-${workflowColumnTone(currentStatus)}`} role="dialog" aria-modal="true" aria-labelledby="task-detail-title">
    <header className="task-detail-header"><div><p className="eyebrow">Task brief</p><h2 id="task-detail-title" dir="auto">{task.title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close task details"><X size={22} /></button></header>
    <div className="task-detail-body">
      <div className="detail-status-line"><span className={`detail-tone tone-${workflowColumnTone(currentStatus)}`}><i />{boardStatusLabel[boardField]} · {currentStatus}</span><PriorityPill priority={task.priority} /></div>
      <dl className="task-facts"><div><dt>Owner</dt><dd>{task.owner ?? "Unassigned"}</dd></div><div><dt>Development status</dt><dd>{task.developmentStatus ?? "Not set"}</dd></div><div><dt>Task status</dt><dd>{task.deliveryStatus ?? "Not set"}</dd></div><div><dt>Start date</dt><dd>{formatDate(task.startDate)}</dd></div></dl>
      <section className="task-detail-copy"><h3>Details</h3>{task.notes ? <p dir="auto">{task.notes}</p> : <p className="empty-detail">No extra task details were provided in the Sheet.</p>}</section>
      <section className="task-status-action"><div><span>Move {boardStatusLabel[boardField].toLowerCase()}</span><strong>Update the matching Sheet column only</strong></div><select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} disabled={isSaving}>{moveOptions.map((status) => <option key={status} value={status} disabled={status === "Not set"}>{status}</option>)}</select><button className="button primary" onClick={async () => { if (await onMove(task, nextStatus)) onClose(); }} disabled={isSaving || nextStatus === currentStatus || nextStatus === "Not set"}>{isSaving ? <LoaderCircle className="spin" size={16} /> : "Update"}</button></section>
    </div>
    <footer className="task-detail-footer"><div>{sourceUrl && <a className="button secondary" href={sourceUrl} target="_blank" rel="noreferrer"><ExternalLink size={16} />Open Sheet</a>}<button className="button secondary" onClick={() => void copyDetails()}><Clipboard size={16} />{copied ? "Copied" : "Copy task"}</button></div><button className="button quiet" onClick={onClose}>Close</button></footer>
  </section></div>;
}

function ConnectModal({ session, state, onClose, onSession, onImport }: { session: Session; state: PortfolioState; onClose: () => void; onSession: (session: Session) => void; onImport: (state: PortfolioState) => void }) {
  const [sheets, setSheets] = useState<SheetFile[]>([]);
  const [spreadsheetId, setSpreadsheetId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (session.connected) { setLoading(true); api.sheets().then((result) => setSheets(result.files)).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Unable to load spreadsheets.")).finally(() => setLoading(false)); } }, [session.connected]);
  const importSheet = async (id: string) => { try { setLoading(true); setError(null); onImport(await api.importSheet(id)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to import the spreadsheet."); } finally { setLoading(false); } };
  const connect = async () => { try { setLoading(true); setError(null); onSession(await api.connect()); } catch (reason) { setError(reason instanceof Error ? reason.message : "Google connection was not completed."); } finally { setLoading(false); } };
  const disconnect = async () => { try { setLoading(true); await api.disconnect(); onSession({ ...session, connected: false, email: null }); setSheets([]); } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to disconnect."); } finally { setLoading(false); } };
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="connect-title"><header><div><p className="eyebrow">Data source</p><h2 id="connect-title">Google Sheets connection</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={20} /></button></header>
    {!session.googleConfigured ? <div className="connect-empty"><span><Sheet size={26} /></span><h3>Google connection is unavailable</h3><p>This deployment is missing its public Google Client ID.</p></div> : !session.connected ? <div className="connect-empty"><span><Sheet size={26} /></span><h3>Connect your Google account</h3><p>Project Pulse reads your Sheet and updates only the workflow-status cell when you move a task.</p>{error && <div className="error-message"><AlertTriangle size={17} />{error}</div>}<button className="button primary full" onClick={() => void connect()} disabled={loading}>{loading ? <LoaderCircle className="spin" size={17} /> : <Sheet size={17} />}Connect Google Sheets</button></div> : <div className="sheet-picker"><div className="connected-user"><CheckCircle2 size={18} /><span>Connected as <strong>{session.email ?? "Google account"}</strong></span><button onClick={() => void disconnect()} disabled={loading}><Unplug size={15} />Disconnect</button></div><p>Choose a spreadsheet to import. Your current portfolio remains visible until the new data has been read successfully.</p>{error && <div className="error-message"><AlertTriangle size={17} />{error}</div>}<div className="manual-import"><input value={spreadsheetId} onChange={(event) => setSpreadsheetId(event.target.value)} placeholder="Paste a Google Sheets URL or spreadsheet ID" /><button className="button secondary" disabled={loading || spreadsheetId.length < 10} onClick={() => void importSheet(extractSpreadsheetId(spreadsheetId))}>Import</button></div><div className="sheet-list">{loading ? <div className="loading-list"><LoaderCircle className="spin" size={20} />Loading your spreadsheets…</div> : sheets.map((sheet) => <button key={sheet.id} onClick={() => void importSheet(sheet.id ?? "")}><span className="sheet-icon"><Sheet size={19} /></span><span><strong>{sheet.name}</strong><small>Modified {sheet.modifiedTime ? formatDate(sheet.modifiedTime.slice(0, 10)) : "recently"}</small></span><ChevronRight size={18} /></button>)}{!loading && !sheets.length && <EmptyState icon={<Sheet />} title="No spreadsheets found" description="Paste a spreadsheet URL above, or check the Google account you connected." />}</div></div>}
    {state.data.source === "google_sheets" && <footer><span>Current data: <strong>{state.data.spreadsheetName}</strong></span></footer>}
  </section></div>;
}

function extractSpreadsheetId(input: string) { const matched = input.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); return matched?.[1] ?? input.trim(); }

export default App;
