export type Health = "on_track" | "at_risk" | "off_track" | "complete";
export type TaskStatus = "not_started" | "in_progress" | "blocked" | "done" | "cancelled";

export interface Project {
  id: string;
  name: string;
  owner?: string;
  sponsor?: string;
  status?: string;
  health?: Health;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  progress?: number;
  budget?: number;
  actualCost?: number;
  notes?: string;
}

export interface Task {
  id: string;
  projectId: string;
  projectName?: string;
  title: string;
  owner?: string;
  status: TaskStatus;
  priority?: string;
  startDate?: string;
  dueDate?: string;
  completedDate?: string;
  progress?: number;
  effortHours?: number;
  dependency?: string;
  labels?: string[];
  notes?: string;
  developmentStatus?: string;
  deliveryStatus?: string;
  workflowStatus?: string;
  source?: {
    sheetTitle: string;
    rowNumber: number;
    developmentStatusColumn?: number;
    deliveryStatusColumn?: number;
    /** Supports portfolios cached before separate status columns were introduced. */
    statusColumn?: number;
  };
}

export interface Risk { id: string; projectId?: string; title: string; owner?: string; level?: string; status?: string; dueDate?: string }
export interface Milestone { id: string; projectId: string; title: string; dueDate?: string; status?: string; owner?: string }
export interface PortfolioData { projects: Project[]; tasks: Task[]; risks: Risk[]; milestones: Milestone[]; source: "empty" | "google_sheets"; importedAt: string; spreadsheetName?: string; spreadsheetId?: string; mappingNotes: string[] }
export interface ProjectMetrics extends Project { health: Health; progress: number; totalTasks: number; completedTasks: number; inProgressTasks: number; overdueTasks: number; openRisks: number; daysRemaining?: number; costVariance?: number }
export interface PortfolioMetrics {
  totalProjects: number; onTrackProjects: number; atRiskProjects: number; offTrackProjects: number; completeProjects: number;
  totalTasks: number; completedTasks: number; overdueTasks: number; blockedTasks: number; completionRate: number;
  projectMetrics: ProjectMetrics[];
  taskStatusBreakdown: { name: string; value: number; color: string }[];
  priorityBreakdown: { name: string; value: number }[];
  upcomingMilestones: Milestone[];
  attentionItems: { type: "overdue" | "blocked" | "risk"; title: string; projectName?: string; detail: string }[];
}

export interface Session { googleConfigured: boolean; connected: boolean; email: string | null }
export interface SheetFile { id: string; name: string; modifiedTime?: string; webViewLink?: string }
