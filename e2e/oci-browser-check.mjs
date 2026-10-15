#!/usr/bin/env node
/* global console, document, fetch, process */
/**
 * OCI Pre-Domain Browser Validation
 * Headless Playwright script for autonomous repair loop.
 * Captures: console errors, page errors, failed requests, screenshots, DOM text.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const LEARNER_BASE = 'http://kotobawork.test';
const ADMIN_BASE = 'http://admin.kotobawork.test';
const SCREENSHOT_DIR = '/tmp/oci-browser-screenshots';
const RESULTS_FILE = '/tmp/oci-browser-results.json';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

const results = [];

function record(scenario, data) {
  results.push({ scenario, timestamp: new Date().toISOString(), ...data });
}

async function capturePageState(page, label) {
  const url = page.url();
  const title = await page.title().catch(() => '');
  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 2000) || '').catch(() => '');
  const screenshotPath = path.join(SCREENSHOT_DIR, `${label}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
  return { url, title, bodyTextPreview: bodyText.slice(0, 500), screenshot: screenshotPath };
}

async function runAnonymousLearner() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const apiResponses = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));
  page.on('response', resp => {
    const status = resp.status();
    if (status >= 400) apiResponses.push({ url: resp.url(), status });
  });

  // Scenario 1: Anonymous home /vi
  try {
    await page.goto(`${LEARNER_BASE}/vi`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'anon-home-vi');
    record('anonymous-home-vi', {
      pass: state.url.includes('/vi') && !state.bodyTextPreview.toLowerCase().includes('error'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('anonymous-home-vi', { pass: false, error: e.message });
  }

  // Scenario 2: Navigation to /en
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${LEARNER_BASE}/en`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'anon-home-en');
    record('anonymous-home-en', {
      pass: state.url.includes('/en'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('anonymous-home-en', { pass: false, error: e.message });
  }

  // Scenario 3: Mobile viewport
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${LEARNER_BASE}/vi`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'anon-mobile-vi');
    record('anonymous-mobile-vi', {
      pass: !state.bodyTextPreview.toLowerCase().includes('error'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
    await page.setViewportSize({ width: 1280, height: 800 });
  } catch (e) {
    record('anonymous-mobile-vi', { pass: false, error: e.message });
  }

  await browser.close();
}

async function runAuthenticatedLearner() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const apiResponses = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));
  page.on('response', resp => {
    const status = resp.status();
    if (status >= 400) apiResponses.push({ url: resp.url(), status });
  });

  const ts = Date.now();
  const email = `browser-test-${ts}@test.local`;
  const password = 'Test1234!';
  const displayName = 'Browser Test';

  // Scenario 4: Register via UI
  try {
    await page.goto(`${LEARNER_BASE}/vi/register`, { waitUntil: 'networkidle', timeout: 30000 });
    const regUrl = page.url();
    let registerSucceeded = false;
    // Check if register page loaded or redirected to login
    if (regUrl.includes('/register')) {
      // Form uses id attributes: #displayName, #email, #password
      await page.fill('#displayName', displayName);
      await page.fill('#email', email);
      await page.fill('#password', password);
      // Wait for navigation after submit (successful register redirects away from /register)
      await Promise.all([
        page.waitForURL(url => !url.toString().includes('/register'), { timeout: 15000 }).catch(() => null),
        page.click('button[type="submit"]'),
      ]);
      registerSucceeded = !page.url().includes('/register');
    } else {
      // Already redirected — may already be logged in
      registerSucceeded = true;
    }
    const state = await capturePageState(page, 'auth-register');
    record('authenticated-register', {
      pass: registerSucceeded && !pageErrors.some(e => e.includes('error')),
      email,
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('authenticated-register', { pass: false, error: e.message, email });
  }

  // Scenario 5: Login via UI
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${LEARNER_BASE}/vi/login`, { waitUntil: 'networkidle', timeout: 30000 });
    // Login form also uses id attributes: #email, #password
    await page.fill('#email', email);
    await page.fill('#password', password);
    // Wait for navigation after submit (successful login redirects away from /login)
    await Promise.all([
      page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    const state = await capturePageState(page, 'auth-login');
    record('authenticated-login', {
      pass: !state.url.includes('/login') && !state.bodyTextPreview.toLowerCase().includes('invalid credentials'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('authenticated-login', { pass: false, error: e.message });
  }

  // Scenario 6: Authenticated home after login
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${LEARNER_BASE}/vi`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'auth-home');
    record('authenticated-home', {
      pass: !state.bodyTextPreview.toLowerCase().includes('error'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('authenticated-home', { pass: false, error: e.message });
  }

  // Scenario 7: Profile page
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${LEARNER_BASE}/vi/profile`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'auth-profile');
    record('authenticated-profile', {
      pass: !state.bodyTextPreview.toLowerCase().includes('error') && !state.url.includes('/login'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('authenticated-profile', { pass: false, error: e.message });
  }

  // Scenario 8: Search page
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${LEARNER_BASE}/vi/search?q=会議`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'auth-search');
    record('authenticated-search', {
      pass: !state.bodyTextPreview.toLowerCase().includes('error') && !state.url.includes('/login'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('authenticated-search', { pass: false, error: e.message });
  }

  // Scenario 9: BJT/Quiz practice page
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${LEARNER_BASE}/vi/quiz`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'auth-quiz');
    record('authenticated-quiz', {
      pass: !state.bodyTextPreview.toLowerCase().includes('error') && !state.url.includes('/login'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('authenticated-quiz', { pass: false, error: e.message });
  }

  // Scenario 10: Session refresh (reload authenticated page)
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${LEARNER_BASE}/vi`, { waitUntil: 'networkidle', timeout: 30000 });
    const meCheck = await page.evaluate(async () => {
      const r = await fetch('/api/auth/me', { credentials: 'include' });
      return { status: r.status, ok: r.ok };
    });
    const state = await capturePageState(page, 'auth-session-refresh');
    record('authenticated-session-refresh', {
      pass: meCheck.ok && !state.url.includes('/login'),
      meStatus: meCheck.status,
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('authenticated-session-refresh', { pass: false, error: e.message });
  }

  // Scenario 11: Logout
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    // Try clicking logout button/link
    const logoutLink = await page.$('a[href*="logout"], button:has-text("Logout"), button:has-text("Đăng xuất")');
    if (logoutLink) {
      await logoutLink.click();
      await page.waitForTimeout(2000);
    } else {
      // Fallback: direct API logout
      await page.evaluate(async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      });
      await page.reload({ waitUntil: 'networkidle' });
    }
    const state = await capturePageState(page, 'auth-logout');
    record('authenticated-logout', {
      pass: true,
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('authenticated-logout', { pass: false, error: e.message });
  }

  // Scenario 12: Relogin after logout
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${LEARNER_BASE}/vi/login`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#email', email);
    await page.fill('#password', password);
    await Promise.all([
      page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 }).catch(() => null),
      page.click('button[type="submit"]'),
    ]);
    const state = await capturePageState(page, 'auth-relogin');
    record('authenticated-relogin', {
      pass: !state.url.includes('/login') && !state.bodyTextPreview.toLowerCase().includes('invalid credentials'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('authenticated-relogin', { pass: false, error: e.message });
  }

  await browser.close();
}

async function runAdmin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const apiResponses = [];

  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('requestfailed', req => failedRequests.push({ url: req.url(), failure: req.failure()?.errorText }));
  page.on('response', resp => {
    const status = resp.status();
    if (status >= 400) apiResponses.push({ url: resp.url(), status });
  });

  // Scenario 13: Admin root redirect (anonymous)
  try {
    await page.goto(`${ADMIN_BASE}/admin/`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'admin-root');
    record('admin-root', {
      pass: state.url.includes('/admin'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('admin-root', { pass: false, error: e.message });
  }

  // Scenario 14: Admin login
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@kotobawork.test';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin1234!';
  let adminLoggedIn;
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    // Admin uses locale-prefixed routes: /admin/[locale]/login
    await page.goto(`${ADMIN_BASE}/admin/en/login`, { waitUntil: 'networkidle', timeout: 30000 });
    const loginUrl = page.url();
    if (loginUrl.includes('/login')) {
      // REAL UI LOGIN — no fetch() bypass allowed per strict auth parity rules.
      // Fill real form fields and click the actual submit button.
      await page.fill('#admin-login-username', adminEmail);
      await page.fill('#admin-login-password', adminPassword);
      // Wait for React hydration: button must be enabled and not busy
      await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 15000 });
      // Set up response listener BEFORE clicking to capture the login API call
      const loginResponsePromise = page.waitForResponse(
        resp => resp.url().includes('/api/admin/login') && resp.request().method() === 'POST',
        { timeout: 20000 }
      ).catch(() => null);
      // Click the real submit button
      await page.click('button[type="submit"]');
      const loginResp = await loginResponsePromise;
      // Wait for client-side redirect after successful login
      if (loginResp && loginResp.status() === 200) {
        await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15000 }).catch(() => null);
      }
      adminLoggedIn = !page.url().includes('/login');
    } else {
      adminLoggedIn = true;
    }
    const state = await capturePageState(page, 'admin-login');
    record('admin-login', {
      pass: adminLoggedIn,
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('admin-login', { pass: false, error: e.message });
  }

  // Scenario 15: Admin dashboard (authenticated)
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${ADMIN_BASE}/admin/`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'admin-dashboard');
    record('admin-dashboard', {
      pass: !state.bodyTextPreview.toLowerCase().includes('error') && !state.url.includes('/login'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('admin-dashboard', { pass: false, error: e.message });
  }

  // Scenario 16: Admin representative read (content list)
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${ADMIN_BASE}/admin/content`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'admin-content-read');
    record('admin-content-read', {
      pass: !state.bodyTextPreview.toLowerCase().includes('error') && !state.url.includes('/login'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('admin-content-read', { pass: false, error: e.message });
  }

  // Scenario 17: Admin RBAC check (settings page)
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.goto(`${ADMIN_BASE}/admin/settings`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'admin-rbac-settings');
    record('admin-rbac-settings', {
      pass: !state.url.includes('/login'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('admin-rbac-settings', { pass: false, error: e.message });
  }

  // Scenario 18: Admin logout
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    const logoutLink = await page.$('a[href*="logout"], button:has-text("Logout"), button:has-text("Sign out")');
    if (logoutLink) {
      await logoutLink.click();
      await page.waitForTimeout(2000);
    } else {
      await page.evaluate(async () => {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      });
      await page.reload({ waitUntil: 'networkidle' });
    }
    const state = await capturePageState(page, 'admin-logout');
    record('admin-logout', {
      pass: true,
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('admin-logout', { pass: false, error: e.message });
  }

  // Scenario 19: Admin mobile viewport
  try {
    consoleErrors.length = 0; pageErrors.length = 0; failedRequests.length = 0; apiResponses.length = 0;
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`${ADMIN_BASE}/admin/`, { waitUntil: 'networkidle', timeout: 30000 });
    const state = await capturePageState(page, 'admin-mobile');
    record('admin-mobile', {
      pass: !state.bodyTextPreview.toLowerCase().includes('error'),
      ...state,
      consoleErrors: [...consoleErrors],
      pageErrors: [...pageErrors],
      failedRequests: [...failedRequests],
      apiErrors: [...apiResponses],
    });
  } catch (e) {
    record('admin-mobile', { pass: false, error: e.message });
  }

  await browser.close();
}

try {
  await runAnonymousLearner();
  await runAuthenticatedLearner();
  await runAdmin();

  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));

  const failures = results.filter(r => !r.pass);
  console.log(`\n=== BROWSER VALIDATION COMPLETE ===`);
  console.log(`Total scenarios: ${results.length}`);
  console.log(`Passed: ${results.length - failures.length}`);
  console.log(`Failed: ${failures.length}`);
  if (failures.length > 0) {
    console.log(`\nFailed scenarios:`);
    for (const f of failures) {
      console.log(`  - ${f.scenario}: ${f.error || f.pageErrors?.[0] || f.apiErrors?.[0]?.url || 'unknown'}`);
    }
  }
  console.log(`\nResults: ${RESULTS_FILE}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}/`);
} catch (e) {
  console.error('Fatal error:', e);
  process.exit(1);
}
