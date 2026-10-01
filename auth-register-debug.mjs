import { chromium } from 'playwright';
const BASE = process.env.STAGING_BASE_URL || 'http://192.168.1.8:18080';
const ts = Date.now();
const testEmail = `reg-debug-${ts}@test.kotoba.works`;

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.clearCookies();
  const page = await context.newPage();

  // Capture ALL network requests/responses
  const allRequests = [];
  page.on('request', req => {
    if (req.url().includes('/api/')) {
      allRequests.push({ type: 'req', method: req.method(), url: req.url(), headers: req.headers() });
    }
  });
  page.on('response', async resp => {
    if (resp.url().includes('/api/')) {
      let body = '';
      try { body = await resp.text(); } catch {}
      allRequests.push({ type: 'resp', status: resp.status(), url: resp.url(), body: body.substring(0, 500) });
    }
  });
  page.on('requestfailed', req => {
    allRequests.push({ type: 'fail', url: req.url(), error: req.failure()?.errorText });
  });

  // Navigate to register page
  await page.goto(`${BASE}/vi/register`, { waitUntil: 'networkidle', timeout: 30000 });

  // List all form elements for debugging
  const formInfo = await page.evaluate(() => {
    const forms = document.querySelectorAll('form');
    const inputs = document.querySelectorAll('input');
    const buttons = document.querySelectorAll('button');
    return {
      formsCount: forms.length,
      forms: Array.from(forms).map(f => ({ action: f.action, method: f.method, id: f.id, className: f.className })),
      inputs: Array.from(inputs).map(i => ({ name: i.name, type: i.type, id: i.id, placeholder: i.placeholder, required: i.required })),
      buttons: Array.from(buttons).map(b => ({ text: b.textContent?.trim(), type: b.type, disabled: b.disabled, form: b.form?.id }))
    };
  });
  console.log('=== FORM STRUCTURE ===');
  console.log(JSON.stringify(formInfo, null, 2));

  // Fill form fields by trying multiple selectors
  console.log('\n=== FILLING FORM ===');
  const filled = {};

  // Try display name
  for (const sel of ['input[name="name"]', 'input[name="fullName"]', 'input[name="displayName"]', 'input[id="name"]', 'input[placeholder*="name" i]', 'input[placeholder*="Name"]']) {
    const el = await page.$(sel);
    if (el) { await el.fill('Debug User'); filled.name = sel; break; }
  }

  // Try email
  for (const sel of ['input[name="email"]', 'input[type="email"]', 'input[id="email"]', 'input[placeholder*="email" i]']) {
    const el = await page.$(sel);
    if (el) { await el.fill(testEmail); filled.email = sel; break; }
  }

  // Try password
  for (const sel of ['input[name="password"]', 'input[type="password"]', 'input[id="password"]']) {
    const el = await page.$(sel);
    if (el) { await el.fill('DebugPass2026!'); filled.password = sel; break; }
  }

  console.log('Filled fields:', JSON.stringify(filled));

  // Check for client-side validation errors before submit
  const preSubmitErrors = await page.evaluate(() => {
    const errs = [];
    document.querySelectorAll('[role="alert"], .error, .text-red-500, .text-destructive').forEach(e => {
      if (e.textContent?.trim()) errs.push(e.textContent.trim());
    });
    return errs;
  });
  console.log('Pre-submit validation errors:', preSubmitErrors);

  // Click submit and wait for navigation or response
  console.log('\n=== SUBMITTING ===');
  const submitBtn = await page.$('button[type="submit"]') || await page.$('button:has-text("Create account")') || await page.$('button:has-text("Đăng ký")');
  if (!submitBtn) {
    console.log('ERROR: No submit button found');
    await browser.close();
    return;
  }

  // Listen for navigation
  const navPromise = page.waitForURL(url => !url.toString().includes('/register'), { timeout: 10000 }).catch(() => null);

  await submitBtn.click();
  console.log('Clicked submit button');

  // Wait for potential navigation or API response
  await Promise.race([navPromise, page.waitForTimeout(5000)]);

  // Check post-submit state
  const postUrl = page.url();
  console.log(`Post-submit URL: ${postUrl}`);

  // Check for error messages that appeared after submit
  const postSubmitErrors = await page.evaluate(() => {
    const errs = [];
    document.querySelectorAll('[role="alert"], .error, .text-red-500, .text-destructive, [data-error]').forEach(e => {
      if (e.textContent?.trim()) errs.push(e.textContent.trim());
    });
    return errs;
  });
  console.log('Post-submit errors:', postSubmitErrors);

  // Screenshot
  await page.screenshot({ path: '/tmp/auth-register-debug.png', fullPage: true });

  // Print all captured API calls
  console.log('\n=== ALL API CALLS ===');
  for (const r of allRequests) {
    if (r.type === 'req') console.log(`→ ${r.method} ${r.url}`);
    else if (r.type === 'resp') console.log(`← ${r.status} ${r.url} ${r.body?.substring(0, 200)}`);
    else if (r.type === 'fail') console.log(`✗ FAIL ${r.url}: ${r.error}`);
  }

  await browser.close();
}
run().catch(e => { console.error(e); process.exit(1); });