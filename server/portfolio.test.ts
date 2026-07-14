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

test("maps the Sheet1 task layout and keeps the Status (DEV) cell reference", () => {
  const data = parseSheets([
    { title: "Sheet1", values: [[], [], ["Task", "Priority", "Owner", "Status", "Start date", "Status (DEV)", "Notes"], ["مراجعة واجهة الدخول", "High", "Ragheb & Yarob", "", "14/07/2026", "Ready to Test", "See attachment"]] }
  ], "Khidmet Alalam work");

  assert.equal(data.tasks[0].title, "مراجعة واجهة الدخول");
  assert.equal(data.tasks[0].workflowStatus, "Ready to Test");
  assert.equal(data.tasks[0].status, "in_progress");
  assert.deepEqual(data.tasks[0].source, { sheetTitle: "Sheet1", rowNumber: 4, statusColumn: 6 });
  assert.equal(data.projects[0].name, "Khidmet Alalam work");
});
