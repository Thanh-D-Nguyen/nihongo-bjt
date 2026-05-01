#!/usr/bin/env node
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const phaseId = process.env.PHASE_ID || process.env.BROWSER_REVIEW_PHASE_ID || "UNKNOWN_PHASE";
const app = process.env.BROWSER_REVIEW_APP || "web";
const baseURL = process.env.PLAYWRIGHT_BASE_URL || (app === "admin" ? "http://127.0.0.1:3001" : "http://127.0.0.1:3000");
const rawRoutes = process.env.BROWSER_REVIEW_ROUTES || "/vi";
const totalTimeoutMs = Number(process.env.BROWSER_REVIEW_TIMEOUT_MS || 120_000);
const serverTimeoutMs = Number(process.env.BROWSER_REVIEW_SERVER_TIMEOUT_MS || 60_000);
const restartOn404 = process.env.BROWSER_REVIEW_RESTART_ON_404 !== "0";
const maxAttempts = restartOn404 ? 2 : 1;
const outRoot = process.env.BROWSER_REVIEW_OUT_DIR || "company/reviews/browser-phase-review";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outDir = join(outRoot, "artifacts", `${phaseId}-${stamp}`);
const reportPath = join(outRoot, `${phaseId.toLowerCase()}-${stamp}.md`);
const appPort = Number(new URL(baseURL).port || (baseURL.startsWith("https:") ? 443 : 80));
const reviewLocale = process.env.BROWSER_REVIEW_LOCALE || "vi";
const adminReviewUsername = process.env.BROWSER_REVIEW_ADMIN_USERNAME;
const adminReviewPassword = process.env.BROWSER_REVIEW_ADMIN_PASSWORD;
const settleMs = Number(process.env.BROWSER_REVIEW_SETTLE_MS || 1_000);
const loadingTimeoutMs = Number(process.env.BROWSER_REVIEW_LOADING_TIMEOUT_MS || 15_000);

let serverProcess;
let status = "pass";
const findings = [];
const evidence = [];
const runtimeEvents = [];

function adminNavRoutes() {
  const source = readFileSync("apps/admin/lib/admin-nav-data.ts", "utf8");
  const hrefs = [...source.matchAll(/href:\s*"([^"]+)"/g)].map((match) => match[1]);
  return [...new Set(hrefs)].map((href) => {
    const path = href === "/" ? "" : href.startsWith("/") ? href : `/${href}`;
    return `/${reviewLocale}${path}`;
  });
}

const routes =
  rawRoutes === "__ADMIN_ALL__"
    ? adminNavRoutes()
    : rawRoutes
        .split(",")
        .map((route) => route.trim())
        .filter(Boolean);

if (rawRoutes === "__ADMIN_ALL__") {
  runtimeEvents.push(`expanded __ADMIN_ALL__ to ${routes.length} admin route(s)`);
}

const timeout = (ms, label) =>
  new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      reject(new Error(`${label} timed out after ${ms}ms`));
    }, ms);
  });

function adminAuthMode() {
  if (app !== "admin") return "not_applicable";
  if (adminReviewUsername && adminReviewPassword) return "password_login";
  if (process.env.NEXT_PUBLIC_ADMIN_TEST_BYPASS === "1" || process.env.ADMIN_TEST_BYPASS === "1") {
    return "local_test_bypass";
  }
  return "existing_session_or_unauthenticated";
}

function worseStatus(current, next) {
  const rank = { pass: 0, pass_with_risks: 1, blocked_environment: 2, block: 3 };
  return rank[next] > rank[current] ? next : current;
}

function loadingTextPattern() {
  return /Đang tải|Loading|読み込み|読み込み中|loading/i;
}

async function fetchOk(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function waitForServer(url, ms) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fetchOk(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

function runCommand(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (error) => resolve({ code: 1, stdout, stderr: error.message }));
    child.on("close", (code) => resolve({ code: code ?? 0, stdout, stderr }));
  });
}

async function killPort(port) {
  const result = await runCommand("lsof", ["-ti", `tcp:${port}`]);
  const pids = result.stdout
    .split(/\s+/)
    .map((pid) => Number(pid))
    .filter(Boolean)
    .filter((pid) => pid !== process.pid);
  if (!pids.length) return;
  runtimeEvents.push(`restarting server: killing ${pids.length} process(es) on port ${port}`);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      // ignore dead process
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 1_500));
  for (const pid of pids) {
    try {
      process.kill(pid, 0);
      process.kill(pid, "SIGKILL");
    } catch {
      // already exited
    }
  }
}

function startServer(port = appPort) {
  const filter = app === "admin" ? "@nihongo-bjt/admin" : "@nihongo-bjt/web";
  const args =
    app === "admin"
      ? ["--filter", filter, "exec", "next", "dev", "--port", String(port), "--webpack"]
      : ["--filter", filter, "exec", "next", "dev", "--port", String(port)];
  const child = spawn("pnpm", args, {
    env: { ...process.env, FORCE_COLOR: "0" },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const logs = [];
  child.stdout.on("data", (chunk) => logs.push(chunk.toString()));
  child.stderr.on("data", (chunk) => logs.push(chunk.toString()));
  child.on("exit", (code, signal) => {
    if (code && code !== 0) findings.push(`server exited code=${code} signal=${signal || "none"}`);
  });
  child.logs = logs;
  return child;
}

async function ensureServer({ forceRestart = false } = {}) {
  if (forceRestart) {
    if (serverProcess && !serverProcess.killed) {
      serverProcess.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 1_000));
    }
    await killPort(appPort);
  } else if (await fetchOk(baseURL)) {
    return true;
  }

  serverProcess = startServer(appPort);
  const ready = await waitForServer(baseURL, serverTimeoutMs);
  if (!ready) {
    status = "blocked_environment";
    findings.push(`server did not become ready at ${baseURL} within ${serverTimeoutMs}ms`);
    if (serverProcess?.logs?.length) {
      findings.push(`server logs: ${serverProcess.logs.join("").slice(-2000)}`);
    }
  }
  return ready;
}

async function loginAdmin(page, attempt, viewportName) {
  if (!(app === "admin" && adminReviewUsername && adminReviewPassword)) return true;

  const loginUrl = new URL(`/${reviewLocale}/login`, baseURL);
  loginUrl.searchParams.set("returnTo", `/${reviewLocale}`);
  await page.goto(loginUrl.toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.fill("#admin-login-username", adminReviewUsername);
  await page.fill("#admin-login-password", adminReviewPassword);
  await Promise.all([
    page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 30_000 }),
    page.click('button[type="submit"]')
  ]);

  const landedPath = new URL(page.url()).pathname;
  if (landedPath.includes("/login")) {
    throw new Error("admin password login stayed on login page");
  }

  runtimeEvents.push(`attempt ${attempt}: ${viewportName} authenticated through admin password login`);
  return true;
}

async function classifyAdminPage(page, url) {
  if (app !== "admin") return [];
  const bodyText = await page.locator("body").innerText({ timeout: 4_000 }).catch(() => "");
  const blockers = [];
  if (
    /Đang xác thực phiên quản trị|Verifying admin session|管理セッション|authenticating admin session/i.test(
      bodyText
    )
  ) {
    blockers.push(`${url} is still showing the admin auth gate`);
  }
  if (/Đăng nhập quản trị|Admin sign in|管理者ログイン/i.test(bodyText)) {
    blockers.push(`${url} redirected to admin login instead of authenticated UI`);
  }
  if (/planned notice|coming soon|under construction|will be implemented|Phase 11/i.test(bodyText)) {
    blockers.push(`${url} still contains placeholder/planned-copy text`);
  }
  if (loadingTextPattern().test(bodyText)) {
    blockers.push(`${url} still shows loading text after ${loadingTimeoutMs}ms`);
  }
  return blockers;
}

async function waitForPageSettled(page, url) {
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => undefined);
  if (settleMs > 0) await page.waitForTimeout(settleMs);

  if (app !== "admin") return;

  const start = Date.now();
  while (Date.now() - start < loadingTimeoutMs) {
    const bodyText = await page.locator("body").innerText({ timeout: 2_000 }).catch(() => "");
    if (!loadingTextPattern().test(bodyText)) {
      return;
    }
    await page.waitForTimeout(500);
  }
  runtimeEvents.push(`${url} still contained loading text after ${loadingTimeoutMs}ms wait`);
}

async function withTotalTimeout(fn) {
  return Promise.race([fn(), timeout(totalTimeoutMs, "browser phase review")]);
}

async function reviewOnce(attempt) {
  const attemptEvidence = [];
  const attemptFindings = [];
  let attemptStatus = "pass";
  let saw404 = false;
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of [
      { name: "desktop", width: 1440, height: 1000 },
      { name: "mobile", width: 390, height: 844 }
    ]) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height }
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15_000);
      try {
        await loginAdmin(page, attempt, viewport.name);
      } catch (error) {
        attemptStatus = worseStatus(attemptStatus, "blocked_environment");
        attemptFindings.push(
          `attempt ${attempt}: ${viewport.name} admin password login failed: ${error.message}`
        );
        await context.close();
        continue;
      }
      for (const route of routes) {
        const url = new URL(route, baseURL).toString();
        const safeRoute = route.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "root";
        const screenshotPath = join(outDir, `${viewport.name}-${safeRoute}.png`);
        try {
          const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
          const responseStatus = response?.status();
          if (responseStatus === 404) {
            saw404 = true;
            attemptStatus = worseStatus(attemptStatus, "pass_with_risks");
            attemptFindings.push(`attempt ${attempt}: ${viewport.name} ${url} returned 404`);
          } else if (!response || responseStatus >= 400) {
            attemptStatus = worseStatus(attemptStatus, "pass_with_risks");
            attemptFindings.push(`attempt ${attempt}: ${viewport.name} ${url} returned ${responseStatus ?? "no response"}`);
          }
          await waitForPageSettled(page, url);
          const adminBlockers = await classifyAdminPage(page, url);
          if (adminBlockers.length) {
            attemptStatus = worseStatus(attemptStatus, "block");
            attemptFindings.push(...adminBlockers.map((blocker) => `attempt ${attempt}: ${viewport.name} ${blocker}`));
          }
          await page.screenshot({ path: screenshotPath, fullPage: true });
          attemptEvidence.push(screenshotPath);
        } catch (error) {
          attemptStatus = worseStatus(attemptStatus, "blocked_environment");
          attemptFindings.push(`attempt ${attempt}: ${viewport.name} ${url}: ${error.message}`);
        }
      }
      await context.close();
    }
  } finally {
    await browser.close().catch(() => undefined);
  }
  return { status: attemptStatus, findings: attemptFindings, evidence: attemptEvidence, saw404 };
}

async function run() {
  await mkdir(outDir, { recursive: true });
  await mkdir(outRoot, { recursive: true });

  if (!(await ensureServer())) return;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await reviewOnce(attempt);
    if (result.saw404 && attempt < maxAttempts && restartOn404) {
      runtimeEvents.push(`404 detected during attempt ${attempt}; restarting ${app} server and retrying once`);
      if (!(await ensureServer({ forceRestart: true }))) return;
      continue;
    }
    status = result.status;
    findings.push(...result.findings);
    evidence.push(...result.evidence);
    break;
  }
}

try {
  await withTotalTimeout(run);
} catch (error) {
  status = "blocked_environment";
  findings.push(error.message);
} finally {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    setTimeout(() => {
      if (!serverProcess.killed) serverProcess.kill("SIGKILL");
    }, 2_000).unref();
  }

  const report = `# Browser Phase Review

Phase: ${phaseId}
Date: ${new Date().toISOString()}
Reviewer agent: bjt-browser-qa

## Runtime Attempt

- app: ${app}
- baseURL: ${baseURL}
- routes: ${routes.join(", ") || "none"}
- admin_auth_mode: ${adminAuthMode()}
- admin_password_login: ${app === "admin" && adminReviewUsername && adminReviewPassword ? "enabled" : "disabled"}
- settle_ms: ${settleMs}
- loading_timeout_ms: ${loadingTimeoutMs}
- timeout_ms: ${totalTimeoutMs}
- restart_on_404: ${restartOn404 ? "yes" : "no"}
- max_attempts: ${maxAttempts}

## Result

${status.toUpperCase()}

## Evidence

${evidence.length ? evidence.map((item) => `- ${item}`).join("\n") : "- none"}

## Findings

${findings.length ? findings.map((item) => `- ${item.replace(/\n/g, "\n  ")}`).join("\n") : "- none"}

## Runtime Events

${runtimeEvents.length ? runtimeEvents.map((item) => `- ${item.replace(/\n/g, "\n  ")}`).join("\n") : "- none"}
`;

  await writeFile(reportPath, report, "utf8");
  console.log(
    JSON.stringify(
      {
        browser_phase_review: {
          status,
          phase_id: phaseId,
          app,
          baseURL,
          routes,
          admin_auth_mode: adminAuthMode(),
          evidence: [reportPath, ...evidence],
          findings,
          runtime_events: runtimeEvents
        }
      },
      null,
      2
    )
  );
  // Playwright/Next.js can leave handles open in local dev environments.
  // The report is already written, so exit explicitly to keep unattended agents from hanging.
  process.exit(0);
}
