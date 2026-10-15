#!/usr/bin/env bash
set -euo pipefail

browser-use <<'PY'
import json
import time

base = "http://localhost:18081"
authorized = json.load(open("tmp/local-audit/audit-134-admin.json"))
roleless = json.load(open("tmp/local-audit/audit-134-roleless.json"))
cdp("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=1, mobile=True)

def errors_listener():
    js("window.__auditErrors=[];window.addEventListener('error',e=>window.__auditErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__auditErrors.push(String(e.reason)))")

def login(credentials):
    goto_url(base + "/admin/vi/login")
    wait_for_load()
    values = [credentials["email"], credentials["password"]]
    js("(()=>{const vals=" + json.dumps(values) + ";const inputs=[...document.querySelectorAll('input')].filter(x=>!['hidden','checkbox'].includes(x.type));inputs.forEach((e,i)=>{const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e,vals[i]);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))});document.querySelector('button[type=submit]').click()})()")
    for _ in range(60):
        time.sleep(.2)
        if "/admin/vi/login" not in page_info()["url"]:
            break
    assert "/admin/vi/login" not in page_info()["url"], "real Admin login did not leave the login screen"

def logout():
    js("[...document.querySelectorAll('a')].find(a=>a.href.includes('/auth/logout')&&a.getClientRects().length)?.click()")
    for _ in range(100):
        time.sleep(.2)
        if "/admin/vi/login" in page_info()["url"]:
            break
    assert "/admin/vi/login" in page_info()["url"], "Admin logout did not end the session"

# Ensure the shared headed browser begins anonymous.
goto_url(base + "/admin/vi")
wait_for_load()
if "/admin/vi/login" not in page_info()["url"]:
    logout()

goto_url(base + "/admin/vi/legal/retention")
wait_for_load()
assert "/admin/vi/login" in page_info()["url"], page_info()

login(roleless)
goto_url(base + "/admin/vi/legal/retention")
wait_for_load()
errors_listener()
for _ in range(30):
    time.sleep(.2)
    if js("Boolean(document.querySelector('[role=alert]'))"):
        break
assert js("Boolean(document.querySelector('[role=alert]'))"), js("document.body.innerText")[-500:]
assert js("document.documentElement.clientWidth") == 390 and js("document.documentElement.scrollWidth<=document.documentElement.clientWidth")
logout()

login(authorized)
goto_url(base + "/admin/vi/legal/retention")
wait_for_load()
errors_listener()
for _ in range(40):
    time.sleep(.2)
    if js("document.querySelectorAll('tbody tr').length") == 7:
        break
want = {"users", "battle.sessions", "messages", "auth.sessions", "logs.audit", "logs.events", "privacy.requests"}
screen_text = js("document.body.innerText")
assert all(domain in screen_text for domain in want), screen_text
assert js("document.documentElement.clientWidth") == 390 and js("document.documentElement.scrollWidth<=document.documentElement.clientWidth")
assert not js("window.__auditErrors"), js("window.__auditErrors")
cookies = [x for x in cdp("Storage.getCookies")["cookies"] if x.get("domain") == "localhost" and x.get("name") == "bjt_admin_session"]
assert cookies and cookies[0].get("httpOnly") is True, cookies
print(json.dumps({"screen":page_info(),"anonymous_redirect":True,"roleless_error_visible":True,"domains":sorted(want),"rendered_rows":js("document.querySelectorAll('tbody tr').length"),"page_overflow":False,"window_errors":js("window.__auditErrors"),"httpOnly_admin_cookie":cookies[0]["httpOnly"]},ensure_ascii=False))
PY
