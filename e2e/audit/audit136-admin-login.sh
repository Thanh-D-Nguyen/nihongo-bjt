#!/usr/bin/env bash
set -euo pipefail

BH_RECORD=0 browser-use <<'PY'
import json
import time

base = "http://localhost:18081"
credentials = json.load(open("tmp/local-audit/audit-136-admin.json"))
admin_tab = next(tab for tab in list_tabs() if "/admin/vi/login" in tab["url"])
switch_tab(admin_tab, activate=True)
cdp("Emulation.setDeviceMetricsOverride", width=390, height=844, deviceScaleFactor=1, mobile=True)
goto_url(base + "/admin/vi/login?returnTo=%2Fadmin%2Fvi")
wait_for_load()
activate_tab(current_tab())
for _ in range(50):
    if js("document.visibilityState==='visible' && document.querySelector('main')?.parentElement?.hidden===false"):
        break
    time.sleep(.2)
assert js("document.visibilityState==='visible' && document.querySelector('main')?.parentElement?.hidden===false")
assert "/admin/vi/login" in page_info()["url"], page_info()
assert js("document.documentElement.clientWidth") == 390
assert js("document.documentElement.scrollWidth<=document.documentElement.clientWidth")

def fill(name, value):
    js("(()=>{const e=document.querySelector('input[name=" + json.dumps(name) + "]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(e," + json.dumps(value) + ");e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}))})()")

def submit():
    js("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Đăng nhập'))?.click()")

def wait_for_alert():
    for _ in range(50):
        time.sleep(.2)
        if js("Boolean(document.querySelector('[role=alert]'))"):
            return
    raise AssertionError("login form did not show its localized error")

errors_listener = js("(()=>{window.__auditErrors=[];window.addEventListener('error',e=>window.__auditErrors.push(e.message));window.addEventListener('unhandledrejection',e=>window.__auditErrors.push(String(e.reason)));return true})()")
assert errors_listener is True
assert js("(()=>{window.__auditLoginRequests=[];sessionStorage.removeItem('__auditAdminLoginRequests');const original=window.fetch;window.fetch=function(input,init){const url=new URL(typeof input==='string'?input:input.url,location.href);const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();const tracked=url.pathname==='/api/admin/login';const record={method,path:url.pathname,status:null,ok:false,tokenFields:[]};if(tracked)window.__auditLoginRequests.push(record);return original.apply(this,arguments).then(async response=>{if(tracked){record.status=response.status;const payload=await response.clone().json().catch(()=>null);record.ok=payload?.ok===true;record.tokenFields=payload&&typeof payload==='object'?Object.keys(payload).filter(key=>/token|session|jwt/i.test(key)):[];const requests=JSON.parse(sessionStorage.getItem('__auditAdminLoginRequests')||'[]');requests.push(record);sessionStorage.setItem('__auditAdminLoginRequests',JSON.stringify(requests))}return response})};return true})()") is True
submit()
wait_for_alert()
empty_alert = js("document.querySelector('[role=alert]').innerText")
assert empty_alert
assert js("document.querySelector('#admin-login-username').getAttribute('aria-invalid')==='true'")
assert js("window.__auditLoginRequests.length===0")

fill("email", credentials["email"])
fill("password", "deliberately-wrong-AUDIT-136")
submit()
for _ in range(50):
    time.sleep(.2)
    if js("window.__auditLoginRequests.length===1 && window.__auditLoginRequests[0].status!==null"):
        break
assert js("window.__auditLoginRequests.length===1 && window.__auditLoginRequests[0].method==='POST' && window.__auditLoginRequests[0].status===401")
wrong_password_alert = js("document.querySelector('[role=alert]').innerText")
assert wrong_password_alert and wrong_password_alert != empty_alert
assert "/admin/vi/login" in page_info()["url"]

fill("password", credentials["password"])
submit()
for _ in range(50):
    time.sleep(.2)
    if "/admin/vi/login" not in page_info()["url"]:
        break
for _ in range(75):
    time.sleep(.2)
    if "/admin/vi/login" not in page_info()["url"]:
        break
assert "/admin/vi/login" not in page_info()["url"], page_info()
assert "/admin/vi" in page_info()["url"], page_info()
assert js("(()=>{const requests=JSON.parse(sessionStorage.getItem('__auditAdminLoginRequests')||'[]');return requests.length===2&&requests[0].method==='POST'&&requests[0].path==='/api/admin/login'&&requests[0].status===401&&requests[0].tokenFields.length===0&&requests[1].method==='POST'&&requests[1].path==='/api/admin/login'&&requests[1].status===200&&requests[1].ok&&requests[1].tokenFields.length===0})()")
js("sessionStorage.removeItem('__auditAdminLoginRequests')")
assert js("(()=>{const values=[document.cookie,...Object.entries(localStorage),...Object.entries(sessionStorage)].flat().join(' ');return !/(bjt_admin_session|access[_-]?token|refresh[_-]?token|jwt)/i.test(values) && !/(bjt_admin_session|access[_-]?token|refresh[_-]?token|jwt)/i.test(location.href)})()")
assert js("document.documentElement.clientWidth") == 390
assert js("document.documentElement.scrollWidth<=document.documentElement.clientWidth")
assert not js("window.__auditErrors"), js("JSON.stringify(window.__auditErrors)")
cookies = [x for x in cdp("Storage.getCookies")["cookies"] if x.get("domain") == "localhost" and x.get("name") == "bjt_admin_session"]
assert cookies and cookies[0].get("httpOnly") is True, {"cookie_found":bool(cookies),"httpOnly":bool(cookies and cookies[0].get("httpOnly"))}

goto_url(page_info()["url"])
wait_for_load()
assert "/admin/vi/login" not in page_info()["url"], page_info()
assert js("document.documentElement.clientWidth") == 390
assert js("document.documentElement.scrollWidth<=document.documentElement.clientWidth")
assert not js("window.__auditErrors"), js("JSON.stringify(window.__auditErrors)")
print(json.dumps({"screen":page_info(),"empty_validation":True,"wrong_password_post_status":401,"valid_login_post_status":200,"real_login_redirect":True,"session_persisted_after_refresh":True,"httpOnly_admin_cookie":True,"page_overflow":False,"window_errors":[]},ensure_ascii=False))
PY
