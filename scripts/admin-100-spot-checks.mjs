#!/usr/bin/env node
// Spot-checks for admin authenticated audit. Open + cancel modals; no destructive commits.
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const baseURL = "http://127.0.0.1:3001";
const adminUser = process.env.BROWSER_REVIEW_ADMIN_USERNAME;
const adminPass = process.env.BROWSER_REVIEW_ADMIN_PASSWORD;
const outDir = process.env.OUT_DIR;
if (!outDir) throw new Error("OUT_DIR required");
mkdirSync(outDir, { recursive: true });

const checks = [
  { route: "/vi/iam/admins", id: "iam-admins", action: "open detail drawer", openSelectors: ["text=Chi tiết", "button:has-text('Chi tiết')", "[data-testid='detail-button']", "tbody tr >> nth=0", "button:has-text('Xem')"], cancelSelectors: ["button:has-text('Đóng')", "button:has-text('Hủy')", "[aria-label='Close']", "button[aria-label='Đóng']"] },
  { route: "/vi/iam/roles", id: "iam-roles", action: "open detail drawer", openSelectors: ["button:has-text('Chi tiết')", "tbody tr >> nth=0", "button:has-text('Xem')"], cancelSelectors: ["button:has-text('Đóng')", "button:has-text('Hủy')", "[aria-label='Close']"] },
  { route: "/vi/battle/configs", id: "battle-configs", action: "create modal cancel", openSelectors: ["button:has-text('Tạo mới')", "button:has-text('Tạo cấu hình')", "button:has-text('Tạo')", "button:has-text('Thêm')"], cancelSelectors: ["button:has-text('Hủy')", "button:has-text('Đóng')", "[aria-label='Close']"] },
  { route: "/vi/battle/abuse", id: "battle-abuse", action: "report detail", openSelectors: ["tbody tr >> nth=0", "button:has-text('Chi tiết')", "button:has-text('Xem')"], cancelSelectors: ["button:has-text('Đóng')", "[aria-label='Close']"] },
  { route: "/vi/users", id: "users", action: "suspend modal cancel", openSelectors: ["button:has-text('Tạm khóa')", "button:has-text('Suspend')", "button:has-text('Khóa')"], cancelSelectors: ["button:has-text('Hủy')", "[aria-label='Close']"] },
  { route: "/vi/users/360", id: "users-360-access-block", action: "verify access-reason modal blocks", openSelectors: [], cancelSelectors: [], expectBlock: true },
  { route: "/vi/growth/campaigns", id: "growth-campaigns", action: "create drawer cancel", openSelectors: ["button:has-text('Tạo')", "button:has-text('Thêm')", "button:has-text('Tạo chiến dịch')"], cancelSelectors: ["button:has-text('Hủy')", "[aria-label='Close']"] },
  { route: "/vi/content/versions", id: "content-versions", action: "diff view", openSelectors: ["button:has-text('So sánh')", "button:has-text('Diff')", "tbody tr >> nth=0"], cancelSelectors: ["button:has-text('Đóng')", "[aria-label='Close']"] },
  { route: "/vi/assessment/question-bank", id: "assessment-question-bank", action: "create modal cancel", openSelectors: ["button:has-text('Tạo')", "button:has-text('Thêm câu hỏi')", "button:has-text('Tạo câu hỏi')"], cancelSelectors: ["button:has-text('Hủy')", "[aria-label='Close']"] },
  { route: "/vi/legal/tokushoho", id: "legal-tokushoho", action: "structured form check", openSelectors: [], cancelSelectors: [], expectForm: true },
  { route: "/vi/ops/kill-switches", id: "ops-kill-switches", action: "danger banner + typed-confirmation", openSelectors: ["button:has-text('Bật'), button:has-text('Tắt'), button:has-text('Kill'), button:has-text('Tạm dừng'), button:has-text('Active'), button:has-text('Kích hoạt')"], cancelSelectors: ["button:has-text('Hủy')", "[aria-label='Close']"], expectDangerBanner: true },
  { route: "/vi/privacy/data-requests", id: "privacy-data-requests", action: "erasure typed-confirmation", openSelectors: ["button:has-text('Xóa'), button:has-text('Erasure'), button:has-text('Hủy bỏ'), button:has-text('Xác nhận xóa')"], cancelSelectors: ["button:has-text('Hủy')", "[aria-label='Close']"] }
];

async function login(page) {
  const url = new URL("/vi/login", baseURL);
  url.searchParams.set("returnTo", "/vi");
  await page.goto(url.toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.fill("#admin-login-username", adminUser);
  await page.fill("#admin-login-password", adminPass);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 60_000 }),
    page.click('button[type="submit"]', { timeout: 60_000 })
  ]);
}

async function tryClick(page, selectors) {
  for (const sel of selectors) {
    try {
      const loc = page.locator(sel).first();
      if (await loc.count() > 0 && await loc.isVisible({ timeout: 1500 })) {
        await loc.click({ timeout: 5000 });
        return sel;
      }
    } catch {
      // Try the next selector.
    }
  }
  return null;
}

const results = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();
page.setDefaultTimeout(15000);

try {
  await login(page);
} catch (err) {
  console.error("LOGIN FAIL", err.message);
  process.exit(1);
}

for (const check of checks) {
  const result = { id: check.id, route: check.route, action: check.action, status: "unknown", notes: [] };
  try {
    await page.goto(new URL(check.route, baseURL).toString(), { waitUntil: "domcontentloaded", timeout: 30_000 });
    await page.waitForLoadState("networkidle", { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(1500);

    if (check.expectBlock) {
      // /vi/users/360 (no id) expected to render access-reason / id-required gate
      const body = await page.locator("body").innerText({ timeout: 4000 }).catch(() => "");
      const hasGate = /Học viên|Nhập ID|access reason|lý do truy cập|chưa chọn|chọn học viên|Yêu cầu ID|Required|chọn người dùng/i.test(body);
      result.status = hasGate ? "pass" : "minor";
      result.notes.push(hasGate ? "access-reason / id-required UI present" : "no explicit gate UI detected");
      await page.screenshot({ path: join(outDir, `spot-${check.id}.png`), fullPage: true });
      results.push(result);
      continue;
    }

    if (check.expectForm) {
      const formCount = await page.locator("form, fieldset, input, textarea").count();
      result.status = formCount >= 5 ? "pass" : "minor";
      result.notes.push(`form-element count=${formCount}`);
      await page.screenshot({ path: join(outDir, `spot-${check.id}.png`), fullPage: true });
      results.push(result);
      continue;
    }

    if (check.expectDangerBanner) {
      const body = await page.locator("body").innerText({ timeout: 4000 }).catch(() => "");
      const hasDanger = /Cảnh báo|Nguy hiểm|Danger|kill[- ]?switch|Khẩn cấp|hệ thống|production|kích hoạt|tạm dừng/i.test(body);
      result.notes.push(hasDanger ? "danger-banner copy present" : "no danger banner copy detected");
    }

    const opened = await tryClick(page, check.openSelectors);
    if (opened) {
      result.notes.push(`opened via: ${opened}`);
      await page.waitForTimeout(800);
      await page.screenshot({ path: join(outDir, `spot-${check.id}-opened.png`), fullPage: true });
      const cancelled = await tryClick(page, check.cancelSelectors);
      if (cancelled) {
        result.status = "pass";
        result.notes.push(`cancelled via: ${cancelled}`);
      } else {
        // Try Escape
        await page.keyboard.press("Escape").catch(() => {});
        result.status = "minor";
        result.notes.push("no explicit cancel button matched; sent Escape");
      }
    } else {
      result.status = "minor";
      result.notes.push("could not locate primary action button (selector miss or page is read-only/loading)");
      await page.screenshot({ path: join(outDir, `spot-${check.id}-noaction.png`), fullPage: true });
    }
  } catch (err) {
    result.status = "fail";
    result.notes.push(`error: ${err.message}`);
  }
  results.push(result);
  console.error(`[${result.id}] ${result.status} — ${result.notes.join("; ")}`);
}

await browser.close().catch(() => {});

console.log(JSON.stringify(results, null, 2));
process.exit(0);
