import { test, expect } from "@playwright/test";
test("shift briefing and coverage use actual records without mutating inventory", async ({
  page,
}) => {
  await page.goto("/?browser-demo=1");
  await page.getByRole("tab", { name: /Shift brief/ }).click();
  const horizon = page.getByRole("slider", {
    name: "Assumed days until resupply",
    exact: true,
  });
  await horizon.press("Home");
  await expect(
    page.getByText(/28,400 L estimated reserve at day 0/),
  ).toBeVisible();
  await horizon.press("End");
  await expect(
    page.getByText(/41,800 L estimated shortfall at day 90/),
  ).toBeVisible();
  await page.getByRole("button", { name: "Export brief", exact: true }).click();
  const report = page.getByRole("dialog", {
    name: "Station brief export",
    exact: true,
  });
  await expect(report).toContainText(
    "Fuel inventory: 28,400 L; burn 780 L/day",
  );
  await expect(report).toContainText("simulation/illustrative");
  await expect(
    report.getByRole("link", { name: "Save text file", exact: true }),
  ).toHaveAttribute("download", "POLARIS-maitri-brief.txt");
  await report
    .getByRole("button", { name: "Close dialog", exact: true })
    .click();
  await page.getByRole("tab", { name: "Data readiness", exact: true }).click();
  await page
    .getByRole("checkbox", { name: "Only missing readings", exact: true })
    .check();
  await expect(page.getByRole("table").getByRole("row")).toHaveCount(6);
  await page
    .getByRole("combobox", { name: "Workspace", exact: true })
    .selectOption("operational");
  await page.getByRole("tab", { name: /Shift brief/ }).click();
  await expect(
    page.getByText(
      "Baseline unavailable — add inventory and fuel-burn evidence first.",
      { exact: true },
    ),
  ).toBeVisible();
});
test("overview investigation exposes rule, evidence and historical controls without public writes", async ({
  page,
}) => {
  await page.goto("/?browser-demo=1");
  await page.getByRole("button", { name: /GEN-A Primary generator/ }).click();
  await expect(
    page.getByRole("complementary", { name: "Asset inspector" }),
  ).toContainText("Primary generator");
  await page
    .getByRole("button", { name: "Review incident", exact: true })
    .first()
    .click();
  const incident = page.getByRole("dialog", {
    name: "Incident investigation",
    exact: true,
  });
  await expect(
    incident.getByRole("button", { name: "Acknowledge", exact: true }),
  ).toBeDisabled();
  await expect(
    incident.getByText("2 consecutive samples", { exact: true }),
  ).toBeVisible();
  await incident.getByRole("button", { name: "6 h", exact: true }).click();
  await expect(
    incident.getByRole("img", {
      name: /coolant temperature, degC.*05 Sept 2026, 18:00 UTC/,
    }),
  ).toBeVisible();
  await expect(
    incident.getByText("Trigger > 90 degC", { exact: true }),
  ).toBeVisible();
  await incident
    .getByRole("button", { name: "Original record & lineage", exact: true })
    .click();
  const evidence = page.getByRole("dialog", {
    name: "Evidence & lineage",
    exact: true,
  });
  await expect(
    evidence.getByText("raw / synthetic", { exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(evidence).toHaveCount(0);
  await expect(incident).toBeVisible();
});
async function nav(page: any, name: string) {
  const menu = page.getByRole("button", { name: "Open navigation" });
  if (await menu.isVisible()) await menu.click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: new RegExp(name) })
    .click();
}
test("private maintenance workflow consumes one spare and retains separate recovery", async ({
  page,
}) => {
  await page.goto("/?browser-demo=1");
  await expect(
    page.getByRole("heading", {
      name: "Maitri / Station overview",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start private demo" }).click();
  await expect(
    page.getByText("Private browser demonstration", { exact: true }),
  ).toBeVisible();
  await nav(page, "Alerts & maintenance");
  await page.getByRole("button", { name: "Acknowledge", exact: true }).click();
  await page
    .getByRole("button", { name: "Create work order", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Responsible person")
    .fill("Demo engineer");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create work order", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Allocate 1 coolant filter", exact: true })
    .click();
  await page.getByRole("button", { name: "Start work", exact: true }).click();
  await page
    .getByRole("button", { name: "Use 1 coolant filter", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Resolve with notes", exact: true })
    .click();
  await page
    .getByLabel("Work performed and evidence")
    .fill(
      "Filter replaced in this simulation; sensor still needs a recovery reading.",
    );
  await page
    .getByRole("button", { name: "Save resolution", exact: true })
    .click();
  await expect(
    page.getByText("Sensor unrecovered", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("resolved", { exact: true })).toBeVisible();
  await nav(page, "Logistics");
  const row = page
    .getByRole("row")
    .filter({ hasText: "Coolant filter" })
    .filter({
      has: page.getByRole("button", { name: "Record movement", exact: true }),
    });
  await expect(row).toContainText("2 each");
  await page.reload();
  await page.getByRole("button", { name: "Start private demo" }).click();
  await nav(page, "Alerts & maintenance");
  await expect(page.getByText("resolved", { exact: true })).toBeVisible();
});
test("operational workspace never receives demo values", async ({ page }) => {
  await page.goto("/?browser-demo=1");
  await page
    .getByRole("combobox", { name: "Workspace", exact: true })
    .selectOption("operational");
  await expect(
    page.getByText("Backend not connected · operational data unavailable", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Power balance/ }),
  ).toContainText("—");
});
test("historical NASA replay stays historical and scenarios are independent", async ({
  page,
  browser,
}) => {
  await page.goto("/?browser-demo=1");
  await nav(page, "Environment");
  await page
    .getByRole("button", { name: "NASA POWER sample", exact: true })
    .click();
  await expect(
    page.getByText("Historical replay · never live", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/1–7 January 2024/)).toBeVisible();
  await nav(page, "What-if workspace");
  await page.getByRole("button", { name: "Run scenario", exact: true }).click();
  await expect(
    page.getByText("Power shortfall", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Save comparison", exact: true })
    .click();
  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto("/?browser-demo=1");
  await nav(second, "What-if workspace");
  await expect(
    second.getByRole("heading", { name: "Saved comparisons", exact: true }),
  ).toHaveCount(0);
  await other.close();
});
test("page has no horizontal overflow and dialogs close with Escape", async ({
  page,
}) => {
  await page.goto("/?browser-demo=1");
  await nav(page, "Digital twin");
  await page.getByRole("button", { name: /GEN-A Primary generator/ }).click();
  await page
    .getByRole("button", { name: "Full asset record", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("exercise advances synthetic readings and remains separate from operational records", async ({
  page,
}) => {
  await page.goto("/?browser-demo=1");
  await page
    .getByRole("button", { name: "Run demo exercise", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Run private exercise", exact: true })
    .click();
  const inspector = page.getByRole("complementary", {
    name: "Asset inspector",
  });
  await expect(inspector).toContainText("94");
  await expect(inspector).toContainText("Historical");
  await expect(
    page.getByText("Private browser demonstration", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Workspace", exact: true })
    .selectOption("operational");
  await expect(
    page.getByText("Station topology unavailable", { exact: true }),
  ).toBeVisible();
});
test("low bandwidth and presentation are reversible preferences", async ({
  page,
}) => {
  await page.goto("/?browser-demo=1");
  const mode = page.getByRole("button", {
    name: "Low-bandwidth mode",
    exact: true,
  });
  await mode.click();
  await expect(mode).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByText(/no offline queue or binary deltas/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Presentation mode", exact: true })
    .click();
  await expect(page.getByRole("navigation")).not.toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("navigation")).toBeVisible();
});
