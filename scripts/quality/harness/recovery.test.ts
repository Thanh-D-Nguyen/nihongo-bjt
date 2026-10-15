import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { recover, recoveryPlan } from "./lib/recovery.mjs";

type ProcessResult = { status: number | null; stdout?: string; error?: Error };
type Event = { kind: string; [key: string]: unknown };
let root: string;
const policy = {
  raw: {
    harness: { tasks_dir: "tasks", logs_dir: "tasks/.logs" },
    autonomy: { auto: ["local_development"], forbidden: ["bypass_gates"], decisions: [] }
  }
};
const ok = { status: 0, stdout: "" };

beforeEach(() => {
  root = realpathSync(mkdtempSync(path.join(os.tmpdir(), "quality-recovery-")));
  writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({
      packageManager: "pnpm@10.26.2",
      scripts: { "prisma:generate": "prisma generate", deploy: "publish" },
      devDependencies: { "@playwright/test": "1.59.1", typescript: "6.0.3" }
    })
  );
  writeFileSync(path.join(root, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\n");
  vi.stubEnv("DOCKER_HOST", "");
  vi.stubEnv("DOCKER_CONTEXT", "");
  vi.stubEnv("NPM_CONFIG_REGISTRY", "");
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

function runner(handler: (argv: string[]) => ProcessResult = () => ok) {
  return vi.fn((argv: string[], options: { timeout: number; shell: boolean }) => {
    expect(options.timeout).toBeLessThanOrEqual(60_000);
    expect(options.shell).toBe(false);
    if (argv.includes("context") && argv.includes("inspect"))
      return { status: 0, stdout: JSON.stringify("unix:///var/run/docker.sock") };
    if (argv.includes("image") && argv.includes("inspect"))
      return {
        status: 0,
        stdout: JSON.stringify({ Cmd: ["postgres"], Entrypoint: ["docker-entrypoint.sh"] })
      };
    if (argv.includes("inspect")) return { status: 0, stdout: JSON.stringify(localContainer()) };
    if (argv.join(" ") === "docker context show") return { status: 0, stdout: "default\n" };
    if (argv.includes("--property=LoadState")) return { status: 0, stdout: "loaded\n" };
    if (argv[0].endsWith("/bin/pnpm")) return { status: 0, stdout: "10.26.2\n" };
    if (argv.includes("ps"))
      return {
        status: 0,
        stdout: JSON.stringify({
          ID: "b".repeat(64),
          Service: "db",
          State: argv.includes("--all") ? "exited" : "running",
          Health: argv.includes("--all") ? "" : "healthy"
        })
      };
    return handler(argv);
  });
}

function localContainer() {
  return {
    Id: "b".repeat(64),
    Name: "/existing-db",
    Image: `sha256:${"c".repeat(64)}`,
    Config: {
      Image: "postgres:17",
      Cmd: ["postgres"],
      Entrypoint: ["docker-entrypoint.sh"],
      Labels: {
        "com.docker.compose.project": "fixture",
        "com.docker.compose.service": "db",
        "com.docker.compose.project.working_dir": root,
        "com.docker.compose.project.config_files": path.join(root, "compose.yml")
      }
    },
    HostConfig: {
      Privileged: false,
      NetworkMode: "fixture_default",
      PortBindings: { "5432/tcp": [{ HostIp: "127.0.0.1", HostPort: "15432" }] }
    },
    Mounts: []
  };
}

describe("recovery A-D", () => {
  it("A: starts stopped local Docker, verifies it, records before retrying the goal", () => {
    const events: Event[] = [];
    const run = runner();
    const retry = vi.fn(() => {
      expect(events.at(-1)).toMatchObject({ kind: "recovery_attempt", verified: true });
      return ok;
    });
    const result = recover(
      root,
      policy,
      { kind: "docker-stopped", platform: "darwin" },
      { run, record: (event: Event) => events.push(event), retry }
    );
    expect(result.outcome).toBe("RECOVERED");
    expect(result.attempts).toEqual([
      expect.objectContaining({
        recipe: "docker-desktop",
        command: ["open", "-a", "Docker"],
        exit_code: 0,
        verification_exit: 0,
        verified: true
      })
    ]);
    expect(
      run.mock.calls.some(
        ([argv]) => argv[0] === "node" && argv.at(-2) === "default" && argv.at(-1) === "info"
      )
    ).toBe(true);
    expect(events.map((event) => event.kind)).toEqual([
      "recovery_started",
      "recovery_attempt",
      "recovery_retry"
    ]);
    expect(retry).toHaveBeenCalledOnce();
  });

  it("B: installs missing pnpm at the project pin into a user-local prefix", () => {
    const plan = recoveryPlan(root, policy, { kind: "missing-cli", tool: "pnpm" });
    expect(plan.recipes[0].command).toEqual([
      "npm",
      "install",
      "--global",
      "--prefix",
      path.join(root, "tasks/.logs/tools"),
      "--registry=https://registry.npmjs.org",
      "--ignore-scripts",
      "pnpm@10.26.2"
    ]);
    const result = recover(
      root,
      policy,
      { kind: "missing-cli", tool: "pnpm" },
      { run: runner(), retry: () => ok }
    );
    expect(result.outcome).toBe("RECOVERED");
    expect(result.attempts[0].verified).toBe(true);
  });

  it("recovers dependencies with the frozen lock and checks pnpm's dependency graph", () => {
    const run = runner();
    const result = recover(root, policy, { kind: "dependencies" }, { run, retry: () => ok });
    expect(result.outcome).toBe("RECOVERED");
    expect(run.mock.calls.map(([argv]) => argv)).toEqual([
      ["pnpm", "install", "--frozen-lockfile"],
      ["pnpm", "list", "--depth", "0", "--json"]
    ]);
  });

  it("installs Chromium and launches/closes it as the health check before the original test", () => {
    const run = runner();
    const retry = vi.fn(() => ok);
    expect(recover(root, policy, { kind: "playwright-browser" }, { run, retry }).outcome).toBe(
      "RECOVERED"
    );
    expect(run.mock.calls[0][0]).toEqual(["pnpm", "exec", "playwright", "install", "chromium"]);
    expect(run.mock.calls[1][0].slice(0, 4)).toEqual([
      "pnpm",
      "exec",
      "node",
      "--input-type=module"
    ]);
    expect(run.mock.calls[1][0][5]).toContain("chromium.launch");
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe("recovery failure boundaries", () => {
  it("missing ordinary Go tooling needs local diagnosis rather than user permission", () => {
    const run = runner();
    expect(
      recover(root, policy, { kind: "missing-cli", tool: "go" }, { run, retry: () => ok }).outcome
    ).toBe("NEEDS_DIAGNOSIS");
    expect(run).not.toHaveBeenCalled();
  });

  it("unavailable task history inputs need local reconstruction rather than user permission", () => {
    const run = runner();
    for (const request of [
      { kind: "missing-history", task_id: "AUTO-404" },
      { kind: "missing-history" }
    ]) {
      expect(recover(root, policy, request, { run, retry: () => ok }).outcome).toBe(
        "NEEDS_DIAGNOSIS"
      );
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("unknown safe local recovery recipes remain nonterminal diagnosis", () => {
    const run = runner();
    expect(
      recover(root, policy, { kind: "unknown-local-repair" }, { run, retry: () => ok }).outcome
    ).toBe("NEEDS_DIAGNOSIS");
    expect(run).not.toHaveBeenCalled();
  });

  it("failed health never retries or returns RECOVERED", () => {
    const retry = vi.fn(() => ok);
    const run = runner((argv) => ({ status: argv.includes("info") ? 1 : 0 }));
    const result = recover(
      root,
      policy,
      { kind: "docker-stopped", platform: "darwin" },
      { run, retry }
    );
    expect(result).toMatchObject({
      outcome: "EXHAUSTED",
      attempts: [{ verified: false, verification_exit: 1 }]
    });
    expect(retry).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("BLOCKED");
  });

  it("a failed process is evidenced and its health check still runs", () => {
    const run = runner((argv) => ({ status: argv[0] === "open" ? 1 : 0 }));
    const result = recover(
      root,
      policy,
      { kind: "docker-stopped", platform: "darwin" },
      { run, retry: () => ok }
    );
    expect(result).toMatchObject({
      outcome: "EXHAUSTED",
      attempts: [{ exit_code: 1, verification_exit: 0, verified: false }]
    });
  });

  it("healthy recovery with a failed original goal remains EXHAUSTED", () => {
    expect(
      recover(
        root,
        policy,
        { kind: "dependencies" },
        { run: runner(), retry: () => ({ status: 1 }) }
      )
    ).toMatchObject({ outcome: "EXHAUSTED", retry: { exit_code: 1 } });
  });

  it("does not claim recovery without retrying the original goal", () => {
    expect(recover(root, policy, { kind: "dependencies" }, { run: runner() }).outcome).toBe(
      "EXHAUSTED"
    );
  });

  it("ignores attested success and treats thrown execution/timeout as failure", () => {
    expect(
      recover(
        root,
        policy,
        { kind: "dependencies" },
        { run: () => ({ result: "PASS" }), retry: () => ok }
      ).outcome
    ).toBe("EXHAUSTED");
    expect(
      recover(
        root,
        policy,
        { kind: "dependencies" },
        {
          run: () => {
            throw new Error("timed out");
          },
          retry: () => ok
        }
      )
    ).toMatchObject({ outcome: "EXHAUSTED", attempts: [{ exit_code: -1, verification_exit: -1 }] });
  });

  it("a durable recording failure prevents the effect and retry", () => {
    const run = runner();
    expect(() =>
      recover(
        root,
        policy,
        { kind: "dependencies" },
        {
          run,
          record: () => {
            throw new Error("disk full");
          },
          retry: () => ok
        }
      )
    ).toThrow("disk full");
    expect(run).not.toHaveBeenCalled();
  });

  it("prefers an existing project CLI over any machine install", () => {
    expect(
      recoveryPlan(root, policy, { kind: "missing-cli", tool: "tsc" }).recipes[0].command
    ).toEqual(["pnpm", "exec", "tsc", "--version"]);
    expect(recoveryPlan(root, policy, { kind: "missing-cli", tool: "unknown" }).outcome).toBe(
      "NEEDS_DIAGNOSIS"
    );
  });

  it("repairs project dependencies after an existing project CLI probe fails", () => {
    let probes = 0;
    const run = runner((argv) => (argv.includes("tsc") ? { status: ++probes < 3 ? 1 : 0 } : ok));
    const result = recover(
      root,
      policy,
      { kind: "missing-cli", tool: "tsc" },
      { run, retry: () => ok }
    );
    expect(result.outcome).toBe("RECOVERED");
    expect(result.attempts.map((attempt: { recipe: string }) => attempt.recipe)).toEqual([
      "existing-project-tool",
      "frozen-dependencies"
    ]);
    expect(result.attempts[0].verified).toBe(false);
    expect(result.attempts[1].verified).toBe(true);
  });

  it("a frozen install that rewrites its lock cannot satisfy recovery", () => {
    const retry = vi.fn(() => ok);
    const run = runner((argv) => {
      if (argv.includes("install")) writeFileSync(path.join(root, "pnpm-lock.yaml"), "changed\n");
      return ok;
    });
    expect(recover(root, policy, { kind: "dependencies" }, { run, retry }).outcome).toBe(
      "EXHAUSTED"
    );
    expect(retry).not.toHaveBeenCalled();
  });

  it("a successful but wrong pnpm version cannot satisfy the project pin", () => {
    const run = runner();
    run.mockImplementation((argv) => ({
      status: 0,
      stdout: argv[0].endsWith("pnpm") ? "99.0.0" : ""
    }));
    expect(
      recover(root, policy, { kind: "missing-cli", tool: "pnpm" }, { run, retry: () => ok })
    ).toMatchObject({
      outcome: "EXHAUSTED",
      attempts: [{ verified: false, verification_exit: 0 }]
    });
  });

  it("does not replace a failed project-pinned pnpm install with an unpinned brew install", () => {
    const run = runner((argv) => ({ status: argv[0] === "npm" ? 1 : 0 }));
    const result = recover(
      root,
      policy,
      { kind: "missing-cli", tool: "pnpm", platform: "darwin" },
      { run, retry: () => ok }
    );
    // A project pin must not be replaced with whatever Homebrew currently ships.
    expect(result.outcome).toBe("EXHAUSTED");
    expect(run.mock.calls.some(([argv]) => argv[0] === "brew")).toBe(false);
  });

  it("uses brew only for ordinary allowlisted unpinned tools and verifies the result", () => {
    const run = runner();
    expect(
      recover(
        root,
        policy,
        { kind: "missing-cli", tool: "rg", platform: "darwin" },
        { run, retry: () => ok }
      ).outcome
    ).toBe("RECOVERED");
    expect(run.mock.calls[0][0]).toEqual(["brew", "install", "ripgrep"]);
    expect(
      recoveryPlan(root, policy, { kind: "missing-cli", tool: "docker", platform: "linux" }).outcome
    ).toBe("NEEDS_DIAGNOSIS");
  });

  it("rejects a missing lockfile, privileged request, or option injection", () => {
    rmSync(path.join(root, "pnpm-lock.yaml"));
    expect(recoveryPlan(root, policy, { kind: "dependencies" }).outcome).toBe("NEEDS_DIAGNOSIS");
    expect(
      recoveryPlan(root, policy, { kind: "missing-cli", tool: "rg", privileged: true }).outcome
    ).toBe("DECISION_REQUIRED");
    expect(recoveryPlan(root, policy, { kind: "missing-cli", tool: "--prefix=/etc" }).outcome).toBe(
      "DECISION_REQUIRED"
    );
  });
});

describe("local runtime containment", () => {
  it("uses an existing Colima profile as an alternative without changing Docker context", () => {
    let healthCalls = 0;
    const run = runner((argv) => {
      if (argv.includes("info")) return { status: ++healthCalls < 2 ? 1 : 0 };
      if (argv[0] === "colima" && argv.includes("list"))
        return { status: 0, stdout: JSON.stringify({ name: "default", status: "Stopped" }) };
      return ok;
    });
    const result = recover(
      root,
      policy,
      { kind: "docker-stopped", platform: "darwin", context: "colima" },
      { run, retry: () => ok }
    );
    expect(result.outcome).toBe("RECOVERED");
    expect(result.attempts.map((attempt: { recipe: string }) => attempt.recipe)).toEqual([
      "docker-desktop",
      "existing-colima"
    ]);
    expect(run.mock.calls.some(([argv]) => argv.includes("use"))).toBe(false);
  });

  it("remote Docker environment or actual context endpoint never starts a runtime", () => {
    vi.stubEnv("DOCKER_HOST", "tcp://remote.example:2375");
    const run = runner();
    expect(
      recover(
        root,
        policy,
        { kind: "docker-stopped", platform: "darwin" },
        { run, retry: () => ok }
      ).outcome
    ).toBe("DECISION_REQUIRED");
    expect(run).not.toHaveBeenCalled();
    vi.stubEnv("DOCKER_HOST", "");
    const remote = vi.fn((argv: string[]) =>
      argv.includes("inspect")
        ? { status: 0, stdout: JSON.stringify("ssh://remote.example") }
        : { status: 0, stdout: "default" }
    );
    expect(
      recover(
        root,
        policy,
        { kind: "docker-stopped", platform: "darwin" },
        { run: remote, retry: () => ok }
      ).outcome
    ).toBe("DECISION_REQUIRED");
    expect(remote.mock.calls.some(([argv]) => argv[0] === "open")).toBe(false);
  });

  it("Linux only starts a confirmed existing user service, never sudo/system service", () => {
    const run = runner();
    expect(
      recover(root, policy, { kind: "docker-stopped", platform: "linux" }, { run, retry: () => ok })
        .outcome
    ).toBe("RECOVERED");
    expect(run.mock.calls.map(([argv]) => argv)).toContainEqual([
      "systemctl",
      "--user",
      "start",
      "docker.service"
    ]);
    const absent = runner((argv) => (argv[0] === "systemctl" ? { status: 1 } : ok));
    // Override the helper's loaded-unit response to represent an absent user unit.
    absent.mockImplementation((argv) =>
      argv.includes("inspect")
        ? { status: 0, stdout: JSON.stringify("unix:///var/run/docker.sock") }
        : { status: 0, stdout: argv.includes("--property=LoadState") ? "not-found" : "default" }
    );
    expect(
      recover(
        root,
        policy,
        { kind: "docker-stopped", platform: "linux" },
        { run: absent, retry: () => ok }
      ).outcome
    ).toBe("NEEDS_DIAGNOSIS");
    expect(absent.mock.calls.some(([argv]) => argv.includes("start"))).toBe(false);
  });

  it("rejects empty, short, and wrong container IDs before retrying the goal", () => {
    writeFileSync(path.join(root, "compose.yml"), "services:\n  db:\n    image: postgres:17\n");
    for (const badId of ["", "b", "c".repeat(64)]) {
      const original = runner((argv) => argv.includes("config") ? { status: 0, stdout: JSON.stringify({ name: "fixture", services: { db: { image: "postgres:17" } } }) } : ok);
      const run = vi.fn((argv, options) => argv.includes("ps") && !argv.includes("--all") ? { status: 0, stdout: JSON.stringify({ ID: badId, Service: "db", State: "running", Health: "healthy" }) } : original(argv, options));
      const retry = vi.fn(() => ok);
      const result = recover(root, policy, { kind: "local-service", compose_file: "compose.yml", service: "db" }, { run, retry });
      expect(result.outcome).toBe("EXHAUSTED");
      expect(result.attempts[0].verified).toBe(false);
      expect(retry).not.toHaveBeenCalled();
    }
  });

  it("rejects duplicate healthy rows that omit an inspected container", () => {
    writeFileSync(path.join(root, "compose.yml"), "services:\n  db:\n    image: postgres:17\n");
    const ids = ["b".repeat(64), "d".repeat(64)];
    const base = runner((argv) => argv.includes("config") ? { status: 0, stdout: JSON.stringify({ name: "fixture", services: { db: { image: "postgres:17" } } }) } : ok);
    const run = (argv, options) => {
      if (argv.includes("ps")) return { status: 0, stdout: JSON.stringify((argv.includes("--all") ? ids : [ids[0], ids[0]]).map((ID) => ({ ID, Service: "db", State: "running", Health: "healthy" }))) };
      if (argv.includes("inspect") && !argv.includes("context") && !argv.includes("image")) return { status: 0, stdout: JSON.stringify({ ...localContainer(), Id: argv.at(-1) }) };
      return base(argv, options);
    };
    const retry = vi.fn(() => ok);
    expect(recover(root, policy, { kind: "local-service", compose_file: "compose.yml", service: "db" }, { run, retry }).outcome).toBe("EXHAUSTED");
    expect(retry).not.toHaveBeenCalled();
  });

  it("D: restarts the stopped selected local service in its existing Compose project", () => {
    writeFileSync(path.join(root, "compose.yml"), "services:\n  db:\n    image: postgres:17\n");
    const run = runner((argv) =>
      argv.includes("config")
        ? {
            status: 0,
            stdout: JSON.stringify({
              name: "fixture",
              services: {
                db: {
                  image: "postgres:17",
                  ports: [{ host_ip: "127.0.0.1", published: "5432", target: 5432 }]
                }
              }
            })
          }
        : ok
    );
    const result = recover(
      root,
      policy,
      { kind: "local-service", compose_file: "compose.yml", service: "db" },
      { run, retry: () => ok }
    );
    expect(result.outcome).toBe("RECOVERED");
    expect(
      run.mock.calls.some(
        ([argv]) => argv.includes("up") && argv.includes("--no-deps") && argv.at(-1) === "db"
      )
    ).toBe(true);
    const command = result.attempts[0].command;
    expect(command).toContain("--no-recreate");
    expect(command[command.indexOf("--project-name") + 1]).toBe("fixture");
    expect(command.some((arg: string) => arg.startsWith("quality-"))).toBe(false);
  });

  it("refuses escaped Compose files, nonexistent services and privileged containers", () => {
    symlinkSync(os.tmpdir(), path.join(root, "outside"));
    expect(
      recoveryPlan(root, policy, {
        kind: "local-service",
        compose_file: "outside/compose.yml",
        service: "db"
      }).outcome
    ).toBe("DECISION_REQUIRED");
    writeFileSync(path.join(root, "compose.yml"), "services: {}\n");
    for (const [services, outcome] of [
      [{ other: { image: "postgres:17" } }, "NEEDS_DIAGNOSIS"],
      [{ db: { image: "postgres:17", privileged: true } }, "DECISION_REQUIRED"]
    ] as const) {
      const run = runner((argv) =>
        argv.includes("config")
          ? { status: 0, stdout: JSON.stringify({ name: "fixture", services }) }
          : ok
      );
      expect(
        recover(
          root,
          policy,
          { kind: "local-service", compose_file: "compose.yml", service: "db" },
          { run, retry: () => ok }
        ).outcome
      ).toBe(outcome);
      expect(run.mock.calls.some(([argv]) => argv.includes("up"))).toBe(false);
    }
  });

  it("refuses public ports, external volumes and untrusted images before Compose up", () => {
    writeFileSync(path.join(root, "compose.yml"), "services: {}\n");
    for (const config of [
      {
        services: {
          db: { image: "postgres:17", volumes: [{ type: "volume", source: "production" }] }
        },
        volumes: { production: { external: true } }
      },
      { services: { db: { image: "untrusted.example/exfil:latest" } } }
    ]) {
      const run = runner((argv) =>
        argv.includes("config")
          ? { status: 0, stdout: JSON.stringify({ name: "fixture", ...config }) }
          : ok
      );
      expect(
        recover(
          root,
          policy,
          { kind: "local-service", compose_file: "compose.yml", service: "db" },
          { run, retry: () => ok }
        ).outcome
      ).toBe(
        config.services.db.image.startsWith("untrusted") ? "NEEDS_DIAGNOSIS" : "DECISION_REQUIRED"
      );
      expect(run.mock.calls.some(([argv]) => argv.includes("up"))).toBe(false);
    }
  });

  it("validates explicit project_name and preserves a fixed name plus a standard postgres command", () => {
    writeFileSync(path.join(root, "compose.yml"), "services: {}\n");
    expect(
      recoveryPlan(root, policy, {
        kind: "local-service",
        compose_file: "compose.yml",
        service: "db",
        project_name: "--host=remote"
      }).outcome
    ).toBe("DECISION_REQUIRED");
    const command = ["postgres", "-c", "shared_buffers=256MB"];
    const config = {
      name: "fixture",
      services: {
        db: {
          image: "postgres:17",
          command,
          container_name: "existing-db",
          ports: [{ host_ip: "0.0.0.0" }]
        }
      }
    };
    const run = runner();
    const previous = run.getMockImplementation()!;
    run.mockImplementation((argv, options) => {
      if (argv.includes("config")) return { status: 0, stdout: JSON.stringify(config) };
      if (argv.includes("inspect") && !argv.includes("context") && !argv.includes("image")) {
        const container = localContainer();
        container.Config.Cmd = command;
        return { status: 0, stdout: JSON.stringify(container) };
      }
      return previous(argv, options);
    });
    const result = recover(
      root,
      policy,
      {
        kind: "local-service",
        compose_file: "compose.yml",
        service: "db",
        project_name: "fixture"
      },
      { run, retry: () => ok }
    );
    expect(result.outcome).toBe("RECOVERED");
    expect(result.attempts[0].command).toContain("--no-recreate");
  });

  it("never duplicates fixed names when no existing selected container was found", () => {
    writeFileSync(path.join(root, "compose.yml"), "services: {}\n");
    const run = runner((argv) =>
      argv.includes("config")
        ? {
            status: 0,
            stdout: JSON.stringify({
              name: "fixture",
              services: { db: { image: "postgres:17", container_name: "existing-db" } }
            })
          }
        : ok
    );
    const previous = run.getMockImplementation()!;
    run.mockImplementation((argv, options) =>
      argv.includes("ps") ? { status: 0, stdout: "[]" } : previous(argv, options)
    );
    expect(
      recover(
        root,
        policy,
        { kind: "local-service", compose_file: "compose.yml", service: "db" },
        { run, retry: () => ok }
      ).outcome
    ).toBe("NEEDS_DIAGNOSIS");
    expect(run.mock.calls.some(([argv]) => argv.includes("up"))).toBe(false);
  });

  it("refuses primary-owned containers and actual wildcard bindings even with safe desired config", () => {
    writeFileSync(path.join(root, "compose.yml"), "services: {}\n");
    for (const variant of ["owner", "port"]) {
      const run = runner((argv) =>
        argv.includes("config")
          ? {
              status: 0,
              stdout: JSON.stringify({
                name: "fixture",
                services: { db: { image: "postgres:17" } }
              })
            }
          : ok
      );
      const previous = run.getMockImplementation()!;
      run.mockImplementation((argv, options) => {
        if (argv.includes("inspect") && !argv.includes("context") && !argv.includes("image")) {
          const container = localContainer();
          if (variant === "owner")
            container.Config.Labels["com.docker.compose.project.working_dir"] = os.tmpdir();
          else container.HostConfig.PortBindings["5432/tcp"][0].HostIp = "0.0.0.0";
          return { status: 0, stdout: JSON.stringify(container) };
        }
        return previous(argv, options);
      });
      expect(
        recover(
          root,
          policy,
          { kind: "local-service", compose_file: "compose.yml", service: "db" },
          { run, retry: () => ok }
        ).outcome
      ).toBe("DECISION_REQUIRED");
      expect(run.mock.calls.some(([argv]) => argv.includes("up"))).toBe(false);
    }
  });
});

describe("artifact/history reconstruction", () => {
  it("does not install or generate through a node_modules symlink into another checkout", () => {
    symlinkSync(os.tmpdir(), path.join(root, "node_modules"));
    const run = runner();
    expect(recover(root, policy, { kind: "dependencies" }, { run, retry: () => ok }).outcome).toBe(
      "DECISION_REQUIRED"
    );
    expect(
      recoveryPlan(root, policy, {
        kind: "generated-artifacts",
        script: "prisma:generate",
        artifacts: ["generated/client.js"]
      }).outcome
    ).toBe("DECISION_REQUIRED");
    expect(run).not.toHaveBeenCalled();
  });

  it("uses only an existing generation script with contained named output checks", () => {
    const request = {
      kind: "generated-artifacts",
      script: "prisma:generate",
      artifacts: ["generated/client.js"]
    };
    expect(recoveryPlan(root, policy, request).recipes[0].command).toEqual([
      "pnpm",
      "run",
      "prisma:generate"
    ]);
    expect(recover(root, policy, request, { run: runner(), retry: () => ok }).outcome).toBe(
      "RECOVERED"
    );
    expect(recoveryPlan(root, policy, { ...request, script: "deploy" }).outcome).toBe(
      "DECISION_REQUIRED"
    );
    expect(
      recoveryPlan(root, policy, { ...request, artifacts: ["../primary/client.js"] }).outcome
    ).toBe("DECISION_REQUIRED");
  });

  it("C: reconstructs missing history from the immutable durable task/git base", () => {
    const commit = "a".repeat(40);
    mkdirSync(path.join(root, "tasks"));
    writeFileSync(
      path.join(root, "tasks/AUTO-1.json"),
      JSON.stringify({ id: "AUTO-1", start_head: commit })
    );
    const retry = vi.fn((_context: { commit?: string }) => ok);
    const run = runner((argv) => ({ status: 0, stdout: argv.includes("show") ? commit : "" }));
    expect(
      recover(root, policy, { kind: "missing-history", task_id: "AUTO-1" }, { run, retry }).outcome
    ).toBe("RECOVERED");
    expect(retry.mock.calls[0][0]).toMatchObject({ commit });
    expect(
      run.mock.calls.some(([argv]) =>
        argv.some((arg) => ["fetch", "reset", "commit-tree"].includes(arg))
      )
    ).toBe(false);
    expect(
      recoveryPlan(root, policy, { kind: "missing-history", task_id: "../ACC-001" }).outcome
    ).toBe("NEEDS_DIAGNOSIS");
  });

  it("a missing historical object exhausts local reconstruction, never invents a base", () => {
    mkdirSync(path.join(root, "tasks"));
    writeFileSync(
      path.join(root, "tasks/AUTO-1.json"),
      JSON.stringify({ id: "AUTO-1", start_head: "a".repeat(40) })
    );
    expect(
      recover(
        root,
        policy,
        { kind: "missing-history", task_id: "AUTO-1" },
        { run: runner(() => ({ status: 1 })), retry: () => ok }
      ).outcome
    ).toBe("EXHAUSTED");
  });
});
