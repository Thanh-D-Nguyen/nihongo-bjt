#!/usr/bin/env python3
"""Index and query one document against a disposable real Meilisearch."""
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
NAME = "kotoba-release-search"
PORT = "50289"


def docker(*args, check=True):
    return subprocess.run(["docker", *args], check=check, capture_output=True, text=True)


def main():
    docker("rm", "-f", NAME, check=False)
    docker("run", "--rm", "-d", "--name", NAME, "-p", f"127.0.0.1:{PORT}:7700",
           "-e", "MEILI_NO_ANALYTICS=true", "getmeili/meilisearch:v1.13")
    try:
        url = f"http://127.0.0.1:{PORT}"
        for _ in range(60):
            try:
                if urllib.request.urlopen(url + "/health", timeout=2).status == 200:
                    break
            except OSError:
                time.sleep(0.5)
        else:
            sys.exit("Meilisearch did not become healthy")
        result = subprocess.run(["go", "run", "./internal/search/livecheck"], cwd=ROOT / "apps/api-go",
                                env={**__import__("os").environ, "MEILI_URL": url})
        sys.exit(result.returncode)
    finally:
        docker("stop", NAME, check=False)


if __name__ == "__main__":
    main()
