#!/usr/bin/env bash
set -euo pipefail

browser-use <<'PY'
import json
import time

base = "http://localhost:18081"
authorized = json.load(open("tmp/local-audit/audit-132-admin.json"))
roleless = json.load(open("tmp/local-audit/audit-132-roleless.json"))
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
    js("[...document.querySelectorAll('a')].find(a=>a.href.includes('/auth/logout'))?.click()")
    for _ in range(30):
        time.sleep(.2)
        if "/admin/vi/login" in page_info()["url"]:
            break
    assert "/admin/vi/login" in page_info()["url"], "Admin logout did not end the session"

def observe_categories(expected_status):
    js("window.__legalAudit=[];const old=window.fetch.bind(window);window.fetch=async(i,o={})=>{const r=await old(i,o);const u=typeof i==='string'?i:i.url;if(u.includes('/api/admin/legal/cookie-categories'))window.__legalAudit.push({status:r.status,body:await r.clone().json().catch(()=>null)});return r}")
    js("[...document.querySelectorAll('[role=tab]')].find(x=>x.innerText.includes('Danh mục tracker'))?.click()")
    for _ in range(40):
        time.sleep(.2)
        if js("window.__legalAudit?.length"):
            break
    rows = js("window.__legalAudit||[]")
    assert rows and rows[-1]["status"] == expected_status, rows
    return rows[-1]

# Start from an actually anonymous browser state even if a previous run left an Admin session.
goto_url(base + "/admin/vi")
wait_for_load()
if "/admin/vi/login" not in page_info()["url"]:
    logout()

# Anonymous deep link and endpoint behavior.
goto_url(base + "/admin/vi/legal/cookies")
wait_for_load()
assert "/admin/vi/login" in page_info()["url"], page_info()
anon = js("(async()=>{const r=await fetch('/api/admin/legal/cookie-categories');return {status:r.status,body:await r.json()}})()")
assert anon["status"] == 401, anon

# A genuine roleless Admin session must be denied by the backend and shown as a page error.
login(roleless)
goto_url(base + "/admin/vi/legal/cookies")
wait_for_load()
errors_listener()
denied = observe_categories(403)
denied_text = js("document.body.innerText.toLowerCase()")
assert "không tải được dữ liệu" in denied_text, denied_text[-500:]
logout()

# Authorized Admin login uses the real visible form and Argon2id-backed endpoint.
login(authorized)
goto_url(base + "/admin/vi/legal/cookies")
wait_for_load()
errors_listener()
allowed = observe_categories(200)
body = allowed["body"]
assert body["total"] == 4 and len(body["items"]) == 4 and body["partialSchemaPending"] is True, body
assert {item["key"] for item in body["items"]} == {"essential", "functional", "analytics", "marketing"}, body
assert all(item.get("name") and item.get("description") and item.get("dataCollected") is not None and item.get("retentionDays", 0) > 0 and "optInDefault" in item and "canOptOut" in item and item.get("thirdParties") is not None for item in body["items"]), body
assert page_info()["w"] == 390 and not js("document.documentElement.scrollWidth>innerWidth")
assert not js("window.__auditErrors"), js("window.__auditErrors")
cookies = [x for x in cdp("Storage.getCookies")["cookies"] if x.get("domain") == "localhost" and x.get("name") == "bjt_admin_session"]
assert cookies and cookies[0].get("httpOnly") is True, cookies
print(json.dumps({"screen":page_info(),"anonymous_status":anon["status"],"roleless_status":denied["status"],"authorized_status":allowed["status"],"category_keys":[x["key"] for x in body["items"]],"total":body["total"],"partialSchemaPending":body["partialSchemaPending"],"page_overflow":False,"window_errors":js("window.__auditErrors"),"httpOnly_admin_cookie":cookies[0]["httpOnly"]},ensure_ascii=False))
PY
