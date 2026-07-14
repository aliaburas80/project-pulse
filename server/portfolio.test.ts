import assert from "node:assert/strict";
import test from "node:test";
import { getPortfolioMetrics, parseSheets } from "./portfolio.js";

test("parses common Project and Tasks sheet headers", () => {
  const data = parseSheets([
    { title: "Projects", values: [["Project ID", "Project Name", "Progress", "Start Date", "Due Date"], ["P-1", "Portal", "50%", "01/07/2026", "31/07/2026"]] },
    { title: "Tasks", values: [["Task ID", "Project ID", "Task Name", "Status", "Due Date"], ["T-1", "P-1", "Test task", "In Progress", "15/07/2026"]] }
  ]);
  assert.equal(data.projects[0].name, "Portal");
  assert.equal(data.projects[0].progress, 50);
  assert.equal(data.tasks[0].status, "in_progress");
  assert.equal(data.tasks[0].dueDate, "2026-07-15");
});

test("surfaces blocked tasks in the health and attention metrics", () => {
  const data = parseSheets([
    { title: "Projects", values: [["Project ID", "Project Name"], ["P-1", "Portal"]] },
    { title: "Tasks", values: [["Task ID", "Project ID", "Task Name", "Status"], ["T-1", "P-1", "Blocked task", "Blocked"]] }
  ]);
  const metrics = getPortfolioMetrics(data, "2026-07-14");
  assert.equal(metrics.projectMetrics[0].health, "off_track");
  assert.equal(metrics.attentionItems[0].type, "blocked");
});
