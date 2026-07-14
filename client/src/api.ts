import type { PortfolioData, PortfolioMetrics, Session, SheetFile } from "./types";

export interface TaskStatusUpdate {
  spreadsheetId: string;
  sheetTitle: string;
  rowNumber: number;
  statusColumn: number;
  workflowStatus: string;
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export const api = {
  session: () => request<Session>("/api/session"),
  demo: () => request<{ data: PortfolioData; metrics: PortfolioMetrics }>("/api/demo"),
  sheets: () => request<{ files: SheetFile[] }>("/api/google/spreadsheets"),
  importSheet: (spreadsheetId: string) => request<{ data: PortfolioData; metrics: PortfolioMetrics }>("/api/google/import", { method: "POST", body: JSON.stringify({ spreadsheetId }) }),
  updateTaskStatus: (update: TaskStatusUpdate) => request<{ status: "updated"; workflowStatus: string }>("/api/google/task-status", { method: "POST", body: JSON.stringify(update) }),
  disconnect: () => request<void>("/api/auth/google/disconnect", { method: "POST" })
};
