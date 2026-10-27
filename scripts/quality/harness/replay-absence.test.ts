import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { afterEach, expect, it } from "vitest";

import { makeFixture, type Fixture } from "./fixture";
import { showFile } from "./lib/git.mjs";
import { revertToBase } from "./lib/replay.mjs";

let fx: Fixture;
const originalPath = process.env.PATH;
afterEach(() => { process.env.PATH = originalPath; delete process.env.CI_272_FAIL_BLOB; fx?.cleanup(); });

it("restores absent paths as absent even when git show reports success", () => {
  fx = makeFixture();
  fx.write("empty.txt", "");
  fx.write("tab\tname.txt", "tabbed filename");
  fx.write(":(exclude)file.txt", "literal pathspec");
  const base = fx.commit("empty file");
  fx.write("missing.txt", "new content");
  fx.write("empty.txt", "changed");
  const realGit = execFileSync("which", ["git"], { encoding: "utf8" }).trim();
  const bin = path.join(fx.dir, "fake-bin");
  mkdirSync(bin);
  writeFileSync(path.join(bin, "git"), `#!/bin/sh
if [ "$1" = show ] && [ "$2" = "${base}:missing.txt" ]; then exit 0; fi
if [ "$1" = cat-file ] && [ "$CI_272_FAIL_BLOB" = yes ]; then exit 1; fi
exec "${realGit}" "$@"
`, { mode: 0o755 });
  process.env.PATH = `${bin}${path.delimiter}${originalPath}`;
  revertToBase(fx.dir, base, ["missing.txt", "empty.txt"]);
  expect(existsSync(path.join(fx.dir, "missing.txt")), "historically absent path must be removed").toBe(false);
  expect(fx.read("empty.txt")).toBe("");
  expect(showFile(fx.dir, base, "tab\tname.txt")).toBe("tabbed filename");
  expect(showFile(fx.dir, base, ":(exclude)file.txt")).toBe("literal pathspec");
  expect(() => showFile(fx.dir, "invalid-revision", "missing.txt")).toThrow();
  process.env.CI_272_FAIL_BLOB = "yes";
  expect(() => showFile(fx.dir, base, "empty.txt")).toThrow();
});
