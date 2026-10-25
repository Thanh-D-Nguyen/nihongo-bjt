#!/usr/bin/env python3
"""Replayable infrastructure gate for the Oracle ARM64 release.

Everything runs on the local Docker engine against the CURRENT working tree, so
the evidence is bound to the fingerprint under review (no remote host, no
pre-built images):

1. syntax and isolated control-flow cases of deploy/oci/deploy-release.sh;
2. Compose validation with fixture-only environment values;
3. linux/arm64 builds of migrations, api, web and admin from a clean export of the
   tree (tracked + untracked, ignore rules applied), like the release script's
   `git archive` — host node_modules and build output never enter the context;
4. the web and admin images start as UID 1000 with a writable Next cache and
   serve their HTML plus every referenced JavaScript asset.
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROJECT = "kotoba-release-check"
TAG = "release-check"
APPS = ("migrations", "api", "web", "admin")
ENV = {
    **os.environ,
    "DOCKER_DEFAULT_PLATFORM": "linux/arm64",
    "OCI_SOURCE_DIR": str(ROOT),
    "OCI_RELEASE_SHA": TAG,
    "OCI_PUBLIC_HOST": "release-check.invalid",
    "GOOGLE_OAUTH_CLIENT_ID": "fixture.apps.googleusercontent.com",
}


def run(argv, **kwargs):
    kwargs.setdefault("cwd", ROOT)
    kwargs.setdefault("check", True)
    return subprocess.run(argv, **kwargs)


def export_tree(destination):
    """Copy every non-ignored file of the working tree (including uncommitted changes)."""
    listing = run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                  capture_output=True).stdout
    files = [name for name in listing.split(b"\0") if name and (ROOT / name.decode()).exists()]
    packer = subprocess.Popen(["tar", "-cf", "-", "--null", "-T", "-"], cwd=ROOT,
                              stdin=subprocess.PIPE, stdout=subprocess.PIPE)
    unpacker = subprocess.Popen(["tar", "-xf", "-", "-C", destination], stdin=packer.stdout)
    packer.stdout.close()
    packer.stdin.write(b"\0".join(files) + b"\0")
    packer.stdin.close()
    assert unpacker.wait() == 0 and packer.wait() == 0, "tree export failed"


def fixture_env_file():
    handle = tempfile.NamedTemporaryFile("w", suffix=".env", delete=False)
    handle.write(
        "POSTGRES_PASSWORD=fixture\nREDIS_PASSWORD=fixture\n"
        "MEILI_MASTER_KEY=fixture-only-long-key\nSESSION_SECRET=fixture-only-long-secret\n"
        "OAUTH_STATE_SECRET=fixture-only-long-secret\nGOOGLE_OAUTH_CLIENT_ID=fixture.apps.googleusercontent.com\n"
    )
    handle.close()
    return handle.name


def check_release_controls():
    run(["bash", "-n", "deploy/oci/deploy-release.sh"])
    run([sys.executable, "deploy/oci/deploy-release.test.py"])
    print("PASS deploy-release.sh syntax and control-flow cases")


def check_runtime(app, port_env, path):
    name = f"{PROJECT}-{app}"
    run(["docker", "rm", "-f", name], check=False, capture_output=True)
    run(["docker", "run", "-d", "--name", name, "-p", "127.0.0.1::3000" if app == "web" else "127.0.0.1::3001",
         "-e", "NODE_ENV=production", "-e", f"PORT={port_env}", "-e", "API_URL=http://127.0.0.1:1",
         "-e", f"NEXT_PUBLIC_API_URL=https://{ENV['OCI_PUBLIC_HOST']}",
         f"kotobawork-oci-{app}:{TAG}"], capture_output=True)
    try:
        uid = run(["docker", "exec", name, "id", "-u"], capture_output=True, text=True).stdout.strip()
        assert uid == "1000", f"{app} must run unprivileged, got uid {uid}"
        run(["docker", "exec", name, "sh", "-c", f"test -w /workspace/apps/{app}/.next"], capture_output=True)
        mapping = run(["docker", "port", name, f"{port_env}/tcp"], capture_output=True, text=True).stdout.splitlines()[0]
        base = "http://127.0.0.1:" + mapping.rsplit(":", 1)[1]
        html = None
        for _ in range(60):
            try:
                html = urllib.request.urlopen(base + path, timeout=5).read().decode()
                break
            except OSError:
                time.sleep(1)
        if html is None:
            logs = run(["docker", "logs", name], check=False, capture_output=True, text=True)
            raise AssertionError(f"{app} did not serve {path}\n{logs.stdout}{logs.stderr}")
        scripts = set(re.findall(r'<script[^>]+src="([^"]+)"', html))
        assert scripts, f"{app} HTML references no scripts"
        for asset in scripts:
            response = urllib.request.urlopen(base + asset, timeout=15)
            assert response.status == 200 and "javascript" in response.headers["Content-Type"], asset
        print(f"PASS {app} ARM64 runtime {path}: uid 1000, writable cache, {len(scripts)} assets")
    finally:
        run(["docker", "rm", "-f", name], check=False, capture_output=True)


def main():
    check_release_controls()
    env_file = fixture_env_file()
    source = tempfile.mkdtemp(prefix="kotoba-release-source-")
    try:
        export_tree(source)
        env = {**ENV, "OCI_SOURCE_DIR": source, "OCI_ENV_FILE": env_file}
        compose = ["docker", "compose", "--project-name", PROJECT, "--env-file", env_file,
                   "-f", f"{source}/deploy/oci/docker-compose.oci.yml"]
        run([*compose, "config", "--quiet"], env=env)
        print("PASS Compose configuration")
        run([*compose, "--profile", "tools", "build", *APPS], env=env)
        for app in APPS:
            info = json.loads(run(["docker", "image", "inspect", f"kotobawork-oci-{app}:{TAG}"],
                                  capture_output=True, text=True).stdout)[0]
            assert info["Architecture"] == "arm64", f"{app} image is {info['Architecture']}"
        print("PASS linux/arm64 images:", ", ".join(APPS))
        check_runtime("web", "3000", "/vi")
        check_runtime("admin", "3001", "/admin/vi/login")
    finally:
        os.unlink(env_file)
        shutil.rmtree(source, ignore_errors=True)
        for app in APPS:
            run(["docker", "image", "rm", f"kotobawork-oci-{app}:{TAG}"], check=False, capture_output=True)
    print("PASS release infrastructure check")


if __name__ == "__main__":
    main()
