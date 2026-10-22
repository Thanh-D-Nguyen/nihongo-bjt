import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  spawn: vi.fn(),
  config: vi.fn(),
  exists: vi.fn(),
  copy: vi.fn(),
  write: vi.fn(),
  listen: vi.fn()
}));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn, spawnSync: mocks.run }));
vi.mock("dotenv", () => ({ default: { config: mocks.config } }));
vi.mock("node:fs", async (original) => ({
  ...(await original<typeof import("node:fs")>()),
  mkdirSync: vi.fn(),
  openSync: vi.fn(() => 42),
  closeSync: vi.fn(),
  existsSync: mocks.exists,
  copyFileSync: mocks.copy,
  chmodSync: vi.fn(),
  writeFileSync: mocks.write
}));
vi.mock("node:net", () => ({
  default: {
    createServer: () => {
      const server = new EventEmitter();
      return Object.assign(server, {
        listen: (options: { host: string; port: number }, ready: () => void) => {
          if (mocks.listen(options) === "free") queueMicrotask(ready);
          else queueMicrotask(() => server.emit("error", new Error("occupied")));
        },
        close: (done: () => void) => done()
      });
    }
  }
}));

const load = () => import("./local-audit-up.mjs");
let oldArgv: string[];
let oldExitCode: typeof process.exitCode;
let oldSignals: Record<string, NodeJS.RawListener[]>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:15432/local");
  vi.stubEnv("DOCKER_HOST", "unix:///local/docker.sock");
  vi.stubEnv("DOCKER_CONTEXT", "");
  mocks.run.mockReturnValue({ status: 0 });
  mocks.exists.mockReturnValue(true);
  mocks.listen.mockReturnValue(undefined);
  mocks.spawn.mockImplementation(() =>
    Object.assign(new EventEmitter(), { pid: 123, kill: vi.fn() })
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify({ checks: { postgres: "ok", redis: "ok" } })))
  );
  vi.spyOn(console, "log").mockImplementation(() => {});
  oldArgv = process.argv;
  process.argv = [process.execPath, "scripts/local-audit-up.mjs", "--prepare"];
  oldExitCode = process.exitCode;
  oldSignals = Object.fromEntries(
    ["SIGINT", "SIGTERM"].map((signal) => [signal, process.rawListeners(signal)])
  );
});

afterEach(() => {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    for (const listener of process.rawListeners(signal)) {
      if (!oldSignals[signal].includes(listener)) process.removeListener(signal, listener);
    }
  }
  process.argv = oldArgv;
  process.exitCode = oldExitCode;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("local startup", () => {
  it("checks occupied ports before starting Docker or changing the database", async () => {
    await expect(load()).rejects.toThrow("port 3000 is occupied");
    expect(
      mocks.run,
      "occupied ports must stop startup before external commands"
    ).not.toHaveBeenCalled();
  });

  it("refuses a remote database before running any commands", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@db.example.com/production");
    await expect(load()).rejects.toThrow("loopback DATABASE_URL");
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("refuses database connection overrides that can replace the loopback host", async () => {
    vi.stubEnv("DATABASE_URL", "postgresql://user:password@127.0.0.1/local?host=remote.example");
    await expect(load(), "database host overrides must be refused").rejects.toThrow(
      "loopback DATABASE_URL"
    );
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("checks both IPv4 and IPv6 before preparing and waits for HTTP readiness", async () => {
    mocks.listen.mockReturnValue("free");
    vi.mocked(fetch).mockResolvedValueOnce(new Response("starting", { status: 503 }));
    await load();
    expect(mocks.listen.mock.calls.map(([options]) => [options.host, options.port])).toEqual(
      [3000, 3001, 4001, 18081].flatMap((port) => [
        ["127.0.0.1", port],
        ["::1", port]
      ])
    );
    expect(mocks.run.mock.calls.map(([command, args]) => [command, ...args])).toEqual([
      [
        "docker",
        "compose",
        "up",
        "-d",
        "--wait",
        "--wait-timeout",
        "120",
        "postgres",
        "redis",
        "meilisearch",
        "mailpit"
      ],
      ["pnpm", "prisma:generate"],
      [
        "pnpm",
        "exec",
        "prisma",
        "migrate",
        "deploy",
        "--schema",
        "packages/database/prisma/schema.prisma"
      ],
      ["go", "build", "-o", expect.stringContaining("tmp/local-audit/api"), "./cmd/api"],
      [
        "caddy",
        "validate",
        "--config",
        expect.stringContaining("Caddyfile"),
        "--adapter",
        "caddyfile"
      ]
    ]);
    expect(mocks.copy).not.toHaveBeenCalled();
    expect(mocks.spawn).toHaveBeenCalledTimes(4);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Ready!"));
    process.emit("SIGINT");
    for (const child of mocks.spawn.mock.results)
      expect(child.value.kill).toHaveBeenCalledWith("SIGTERM");
    expect(process.exitCode).toBe(0);
  });

  it("stops before migrations or app launch when Docker startup fails", async () => {
    mocks.listen.mockReturnValue("free");
    mocks.run.mockReturnValueOnce({ status: 1 });
    await expect(load()).rejects.toThrow("docker exited 1");
    expect(mocks.run).toHaveBeenCalledTimes(1);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("copies the example env only when missing", async () => {
    mocks.exists.mockReturnValue(false);
    await expect(load()).rejects.toThrow("port 3000 is occupied");
    expect(mocks.copy).toHaveBeenCalledWith(".env.example", ".env");
  });

  it("refuses Docker routing overridden by dotenv before Compose can run", async () => {
    mocks.listen.mockReturnValue("free");
    mocks.config.mockImplementationOnce(() => {
      process.env.DOCKER_CONTEXT = "remote";
    });
    mocks.run.mockReturnValue({ status: 0, stdout: "ssh://remote.example\n" });
    await expect(load(), "dotenv must not redirect local startup to remote Docker").rejects.toThrow(
      "local Docker endpoint"
    );
    expect(mocks.run.mock.calls.some(([, args]) => args.includes("up"))).toBe(false);
    expect(mocks.spawn).not.toHaveBeenCalled();
  });

  it("keeps the audit entrypoint available without database preparation", async () => {
    process.argv = process.argv.slice(0, 2);
    mocks.listen.mockReturnValue("free");
    await load();
    expect(mocks.run.mock.calls.some(([command]) => command === "pnpm")).toBe(false);
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("Ready!"));
  });
});
