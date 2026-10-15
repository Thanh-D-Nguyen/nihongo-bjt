#!/usr/bin/env python3
"""Run with python3 deploy/oci/deploy-release.test.py; no Docker or network needed."""

import io
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tarfile
import tempfile


HERE = Path(__file__).resolve().parent
SHA = "a" * 40
OLD_SHA = "b" * 40
OLD_IMAGES = {app: f"sha256:old-{app}" for app in ("api", "web", "admin")}

# Only these external commands are exposed to the copied deployment script.
STUB = r'''
import json, os, signal, sys
from pathlib import Path

root = Path(os.environ["FIXTURE"])
name, args = Path(sys.argv[0]).name, sys.argv[1:]
state = json.loads((root / "state.json").read_text())
with (root / "calls.jsonl").open("a") as log:
    log.write(json.dumps([name, *args]) + "\n")
sha = os.environ["DEPLOY_SHA"]
mode = os.environ["SCENARIO"]

if name == "git" and args == ["rev-parse", "--show-toplevel"]:
    print(root)
elif name == "git" and args == ["rev-parse", "HEAD"]:
    print(sha)
elif name == "git" and args == ["archive", sha]:
    sys.stdout.buffer.write((root / "release.tar").read_bytes())
elif name == "gh" and args == ["api", "repos/test/repo/git/ref/heads/main", "--jq", ".object.sha"]:
    state["gh"] += 1
    superseded = mode == "superseded" or (mode == "superseded-during-build" and state["gh"] == 2)
    print("c" * 40 if superseded else sha)
elif name == "mountpoint" and args == ["-q", str(root / "base/data")]:
    pass
elif name == "flock" and args == ["-n", "9"]:
    pass
elif name == "docker" and args[:2] == ["inspect", "--format"]:
    print(state["images"][args[-1].split("-")[1]])
elif name == "docker" and args[:2] == ["image", "tag"]:
    state["tags"][args[3]] = args[2]
elif name == "docker" and args[:1] == ["compose"]:
    if "up" in args:
        assert args[-4:] == ["api", "web", "admin", "caddy"], args
        assert "--no-build" in args and "--no-deps" in args, args
        files = [args[i + 1] for i, arg in enumerate(args) if arg == "-f"]
        if len(files) == 2:
            override = Path(files[1]).read_text()
            for app in state["images"]:
                tag = f"kotobawork-oci-{app}:rollback-{sha}"
                assert f"image: {tag}" in override, override
                state["images"][app] = state["tags"][tag]
        else:
            state["images"] = {app: f"new-{sha}-{app}" for app in state["images"]}
    elif "run" in args:
        assert args[-1] == "migrations", args
        state["migrations"] += 1
    elif "build" not in args and args[-2:] != ["config", "--quiet"]:
        raise AssertionError(args)
elif name == "docker" and args == ["exec", "oci-caddy-1", "cat", "/etc/caddy/Caddyfile"]:
    print("old caddy")
elif name == "docker" and args[:4] in (["exec", "oci-caddy-1", "caddy", "validate"], ["exec", "oci-caddy-1", "caddy", "reload"]):
    if args[3] == "reload":
        state["reloads"].append((root / "base/deploy/oci/Caddyfile").read_text())
elif name == "docker" and "psql" in args:
    print("unbaselined" if mode == "unbaselined" else "ready")
elif name == "docker" and "pg_dump" in args:
    sys.stdout.buffer.write(b"fixture database dump\n")
elif name == "docker" and "pg_restore" in args:
    assert sys.stdin.buffer.read() == b"fixture database dump\n"
elif name == "curl":
    state["curls"] += 1
    (root / "state.json").write_text(json.dumps(state))
    if mode == "term":
        os.kill(os.getppid(), signal.SIGTERM)
    if (mode == "curl-fails" and state["curls"] == 1) or (mode == "public-curl-fails" and state["curls"] == 4):
        sys.exit(22)
else:
    raise AssertionError(f"unexpected external command: {name} {args}")
(root / "state.json").write_text(json.dumps(state))
'''


def executable(path, content):
    path.write_text(content)
    path.chmod(0o755)


def check_release(scenario):
    with tempfile.TemporaryDirectory(prefix="oci-release-test-") as temporary:
        root = Path(temporary)
        base = root / "base"
        for directory in ("data", "runtime", "deploy/oci"):
            (base / directory).mkdir(parents=True)
        caddy = base / "deploy/oci/Caddyfile"
        caddy.write_text("old caddy\n")
        (base / "deploy/oci/.env.production").write_text("FIXTURE_ONLY=1\n")
        marker = base / "runtime/release-sha"
        marker.write_text(OLD_SHA + "\n")
        (root / "state.json").write_text(json.dumps({
            "images": OLD_IMAGES, "tags": {}, "gh": 0,
            "migrations": 0, "reloads": [], "curls": 0,
        }))
        verify = root / "scripts/quality/verify-ci-passed.sh"
        verify.parent.mkdir(parents=True)
        executable(verify, '#!/bin/bash\nset -eu\ntest "$1" = "$DEPLOY_SHA"\nprintf verified > "$FIXTURE/verified"\n')
        with tarfile.open(root / "release.tar", "w") as archive:
            for name, content in {
                "deploy/oci/Caddyfile": b"new caddy\n",
                "deploy/oci/docker-compose.oci.yml": b"services: {}\n",
            }.items():
                entry = tarfile.TarInfo(name)
                entry.size = len(content)
                archive.addfile(entry, io.BytesIO(content))
        source = (HERE / "deploy-release.sh").read_text()
        assert source.count("base=/srv/kotobawork\n") == 1, "fixture base replacement must be unambiguous"
        script = root / "deploy-release.sh"
        executable(script, source.replace("base=/srv/kotobawork\n", f"base={shlex.quote(str(base))}\n"))
        commands = root / "bin"
        commands.mkdir()
        for name in ("git", "gh", "docker", "curl", "mountpoint", "flock"):
            executable(commands / name, f"#!{sys.executable}\n" + STUB)
        for name in ("bash", "tar", "install", "cp", "mv"):
            binary = shutil.which(name)
            assert binary, f"missing fixture utility: {name}"
            (commands / name).symlink_to(binary)
        # A clean environment excludes credentials, shell startup hooks and host PATH.
        env = {
            "PATH": str(commands), "HOME": str(root), "FIXTURE": str(root),
            "DEPLOY_SHA": SHA, "OCI_PUBLIC_HOST": "fixture.invalid",
            "GITHUB_REPOSITORY": "test/repo", "SCENARIO": scenario,
        }
        result = subprocess.run([str(commands / "bash"), str(script)], cwd=root,
                                env=env, capture_output=True, text=True, timeout=15)
        detail = f"{scenario}: exit {result.returncode}\n{result.stdout}\n{result.stderr}"
        assert (root / "verified").read_text() == "verified", detail
        state = json.loads((root / "state.json").read_text())
        calls = [json.loads(line) for line in (root / "calls.jsonl").read_text().splitlines()]
        if scenario == "unbaselined":
            assert result.returncode == 3 and "no Prisma migration history" in result.stderr, detail
            assert state["images"] == OLD_IMAGES and state["reloads"] == [], detail
            assert state["migrations"] == state["curls"] == 0 and state["tags"] == {}, detail
            assert not any(call[0:2] == ["docker", "compose"] for call in calls), detail
            assert not (base / f"data/backups/releases/nihongo_bjt-{SHA}.dump").exists(), detail
        elif scenario.startswith("superseded"):
            assert result.returncode == 0 and "superseded" in result.stdout.lower(), detail
            assert state["images"] == OLD_IMAGES and state["reloads"] == [], detail
            assert state["migrations"] == state["curls"] == 0, detail
            assert not any(call[0:2] == ["docker", "compose"] and "up" in call for call in calls), detail
            assert state["gh"] == (1 if scenario == "superseded" else 2), detail
        else:
            assert state["migrations"] == 1 and state["gh"] == 2, detail
            assert state["reloads"] and state["reloads"][0] == "new caddy\n", detail
            backup = base / f"data/backups/releases/nihongo_bjt-{SHA}.dump"
            assert backup.read_bytes() == b"fixture database dump\n", detail
            assert backup.stat().st_mode & 0o077 == 0, "backup must be private"
            if scenario == "success":
                assert result.returncode == 0 and state["curls"] == 4, detail
                assert state["images"] == {app: f"new-{SHA}-{app}" for app in OLD_IMAGES}, detail
                assert state["reloads"] == ["new caddy\n"], detail
            else:
                assert result.returncode == (143 if scenario == "term" else 22), detail
                assert state["images"] == OLD_IMAGES, detail
                assert state["reloads"] == ["new caddy\n", "old caddy\n"], detail
                assert state["curls"] == (4 if scenario == "public-curl-fails" else 1), detail
        succeeded = scenario == "success"
        assert marker.read_text() == (SHA if succeeded else OLD_SHA) + "\n", detail
        assert caddy.read_text() == ("new caddy\n" if succeeded else "old caddy\n"), detail
        print(f"PASS {scenario}")


def check_sources():
    workflow = (HERE.parents[1] / ".github/workflows/deploy-oci.yml").read_text()
    assert "cancel-in-progress: false" in workflow, "deploy cancellation must not interrupt rollback"
    assert workflow.count("github.event.workflow_run.head_sha || github.sha") >= 2, "checkout and deploy must pin the validated SHA"
    dockerfile = (HERE / "Dockerfile.frontend").read_text()
    assert 'chown -R node:node "apps/$APP_NAME/.next"' in dockerfile, "Next cache must be writable by runtime user"
    assert "USER node" in dockerfile, "frontend must run unprivileged"
    print("PASS workflow SHA pinning and frontend cache ownership (source checks)")


if __name__ == "__main__":
    if not __debug__:
        sys.exit("Run without -O: this selfcheck requires assertions")
    for scenario in ("unbaselined", "superseded", "superseded-during-build", "success", "curl-fails", "public-curl-fails", "term"):
        check_release(scenario)
    check_sources()
