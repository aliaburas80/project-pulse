import type { PortfolioData } from "./types.js";

export const samplePortfolio: PortfolioData = {
  source: "sample",
  importedAt: "2026-07-14T09:00:00.000Z",
  spreadsheetName: "Project Pulse demo portfolio",
  mappingNotes: ["Showing demonstration data. Connect a Google Sheet to replace it with your live portfolio."],
  projects: [
    { id: "PRJ-001", name: "TRC Digital Portal", owner: "Ali Abu Ras", sponsor: "Digital Services", status: "In Progress", health: "at_risk", priority: "High", startDate: "2026-05-04", dueDate: "2026-09-15", progress: 62, budget: 185000, actualCost: 112000 },
    { id: "PRJ-002", name: "Citizen Services Mobile App", owner: "Rana Haddad", sponsor: "Citizen Experience", status: "In Progress", health: "on_track", priority: "High", startDate: "2026-06-01", dueDate: "2026-11-28", progress: 38, budget: 230000, actualCost: 79000 },
    { id: "PRJ-003", name: "Data Platform Modernization", owner: "Omar Khalil", sponsor: "Technology", status: "In Progress", health: "off_track", priority: "Critical", startDate: "2026-03-17", dueDate: "2026-08-30", progress: 51, budget: 410000, actualCost: 287000 },
    { id: "PRJ-004", name: "Customer Support Automation", owner: "Sami Yasin", sponsor: "Operations", status: "Closing", health: "on_track", priority: "Medium", startDate: "2026-02-02", dueDate: "2026-07-31", progress: 91, budget: 74000, actualCost: 69500 },
    { id: "PRJ-005", name: "Cybersecurity Controls Uplift", owner: "Lina Abu Odeh", sponsor: "CISO", status: "Planning", health: "on_track", priority: "High", startDate: "2026-07-20", dueDate: "2026-12-18", progress: 12, budget: 145000, actualCost: 9000 }
  ],
  tasks: [
    { id: "T-101", projectId: "PRJ-001", title: "Complete UAT regression cycle", owner: "Huda", status: "in_progress", priority: "High", startDate: "2026-07-01", dueDate: "2026-07-22", progress: 68, effortHours: 48, labels: ["UAT", "Release"] },
    { id: "T-102", projectId: "PRJ-001", title: "Resolve payment gateway defects", owner: "Fadi", status: "blocked", priority: "Critical", startDate: "2026-07-05", dueDate: "2026-07-14", progress: 35, effortHours: 36, dependency: "Gateway vendor response", labels: ["Blocker", "Integration"] },
    { id: "T-103", projectId: "PRJ-001", title: "Prepare go-live readiness pack", owner: "Ali Abu Ras", status: "not_started", priority: "High", startDate: "2026-07-20", dueDate: "2026-08-01", progress: 0, effortHours: 20, labels: ["Governance"] },
    { id: "T-104", projectId: "PRJ-001", title: "Architecture sign-off", owner: "Maha", status: "done", priority: "High", startDate: "2026-06-18", dueDate: "2026-07-02", completedDate: "2026-07-01", progress: 100, effortHours: 12 },
    { id: "T-201", projectId: "PRJ-002", title: "Finish onboarding journey", owner: "Rami", status: "in_progress", priority: "High", startDate: "2026-07-04", dueDate: "2026-07-28", progress: 58, effortHours: 64, labels: ["Mobile", "UX"] },
    { id: "T-202", projectId: "PRJ-002", title: "Run accessibility review", owner: "Dana", status: "not_started", priority: "Medium", startDate: "2026-07-20", dueDate: "2026-08-06", progress: 0, effortHours: 24, labels: ["Quality"] },
    { id: "T-203", projectId: "PRJ-002", title: "API performance baseline", owner: "Yazan", status: "done", priority: "Medium", startDate: "2026-06-21", dueDate: "2026-07-06", completedDate: "2026-07-05", progress: 100, effortHours: 30 },
    { id: "T-301", projectId: "PRJ-003", title: "Remediate data quality exceptions", owner: "Alaa", status: "blocked", priority: "Critical", startDate: "2026-06-15", dueDate: "2026-07-09", progress: 42, effortHours: 80, dependency: "Source-system data extract", labels: ["Data", "Blocker"] },
    { id: "T-302", projectId: "PRJ-003", title: "Migrate customer history", owner: "Omar Khalil", status: "in_progress", priority: "High", startDate: "2026-06-26", dueDate: "2026-07-31", progress: 51, effortHours: 120, labels: ["Migration"] },
    { id: "T-303", projectId: "PRJ-003", title: "Provision production workspace", owner: "IT Ops", status: "done", priority: "High", startDate: "2026-06-10", dueDate: "2026-06-27", completedDate: "2026-06-26", progress: 100, effortHours: 16 },
    { id: "T-401", projectId: "PRJ-004", title: "Train service desk agents", owner: "Sami Yasin", status: "in_progress", priority: "Medium", startDate: "2026-07-02", dueDate: "2026-07-18", progress: 90, effortHours: 32 },
    { id: "T-402", projectId: "PRJ-004", title: "Close hypercare actions", owner: "Nour", status: "not_started", priority: "Low", startDate: "2026-07-18", dueDate: "2026-07-29", progress: 0, effortHours: 20 },
    { id: "T-501", projectId: "PRJ-005", title: "Confirm control owners", owner: "Lina Abu Odeh", status: "in_progress", priority: "High", startDate: "2026-07-20", dueDate: "2026-08-05", progress: 25, effortHours: 28 },
    { id: "T-502", projectId: "PRJ-005", title: "Assess current controls", owner: "Security Team", status: "not_started", priority: "High", startDate: "2026-07-28", dueDate: "2026-08-22", progress: 0, effortHours: 72 }
  ],
  milestones: [
    { id: "M-001", projectId: "PRJ-001", title: "Release readiness review", dueDate: "2026-07-24", status: "At Risk", owner: "Ali Abu Ras" },
    { id: "M-002", projectId: "PRJ-003", title: "Data migration wave 1", dueDate: "2026-07-25", status: "At Risk", owner: "Omar Khalil" },
    { id: "M-003", projectId: "PRJ-004", title: "Operational handover", dueDate: "2026-07-30", status: "On Track", owner: "Sami Yasin" },
    { id: "M-004", projectId: "PRJ-002", title: "Beta release", dueDate: "2026-08-15", status: "On Track", owner: "Rana Haddad" }
  ],
  risks: [
    { id: "R-001", projectId: "PRJ-001", title: "Gateway vendor response may delay UAT completion", owner: "Fadi", level: "high", status: "Open", dueDate: "2026-07-15" },
    { id: "R-002", projectId: "PRJ-003", title: "Incomplete legacy source data could affect migration quality", owner: "Alaa", level: "critical", status: "Open", dueDate: "2026-07-16" },
    { id: "R-003", projectId: "PRJ-005", title: "Control owner availability during discovery", owner: "Lina Abu Odeh", level: "medium", status: "Mitigating", dueDate: "2026-07-25" }
  ]
};
