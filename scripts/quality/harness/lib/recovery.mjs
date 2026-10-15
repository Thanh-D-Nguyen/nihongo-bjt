// Bounded local recovery, not a gate override. The caller persists record(event)
// and supplies retry(context), which reruns the original authorized operation.
// run(argv, options) returns a spawnSync-shaped result; no shell strings execute.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";

import { classifyAction } from "./autonomy.mjs";
import { nowIso, redact, sha256, violation } from "./util.mjs";

const ORDINARY = { rg: "ripgrep", jq: "jq" };
const PROJECT_TOOLS = {
  tsc: "typescript",
  playwright: "@playwright/test",
  prisma: "prisma",
  vitest: "vitest",
  tsx: "tsx",
  eslint: "eslint",
  prettier: "prettier"
};
const NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,63}$/u;
const PROJECT = /^[a-z0-9][a-z0-9_-]{0,63}$/u;
const IMAGE =
  /^(?:postgres|redis|getmeili\/meilisearch|meilisearch\/meilisearch|quay\.io\/keycloak\/keycloak|minio\/minio):[a-zA-Z0-9_.-]+$/u;
const COMMIT = /^[a-f0-9]{40}(?:[a-f0-9]{24})?$/u;
const COMPOSE_START = ["up", "-d", "--no-recreate", "--no-deps", "--wait", "--wait-timeout", "45"];
// Cold Docker startup is asynchronous. Poll inside one bounded health process;
// timers are 250ms, total startup budget 45s, each Docker probe at most 5s.
const DOCKER_READY =
  "const {spawnSync}=await import('node:child_process');const deadline=Date.now()+45000;do{const r=spawnSync('docker',['--context',process.argv[1],'info'],{stdio:'ignore',shell:false,timeout:5000});if(r.status===0&&!r.error&&!r.signal)process.exit(0);await new Promise(resolve=>setTimeout(resolve,250))}while(Date.now()<deadline);process.exit(1)";
const decision = (reason) => ({ outcome: "DECISION_REQUIRED", reason, recipes: [] });
const diagnosis = (reason) => ({ outcome: "NEEDS_DIAGNOSIS", reason, recipes: [] });
const recipe = (id, command, verify, extra = {}) => ({ recipe: id, command, verify, ...extra });
const read = (file) => JSON.parse(readFileSync(file, "utf8"));
const localDocker = (host) => typeof host === "string" && /^unix:\/\/\/[^\s\0]+$/u.test(host);

/** Resolve existing ancestors too, so missing outputs cannot escape via symlinks. */
function contained(root, file) {
  if (typeof file !== "string" || !file || file.includes("\0")) return null;
  const abs = path.resolve(root, file);
  const rel = path.relative(root, abs);
  if (!rel || rel === ".." || rel.startsWith(`..${path.sep}`) || path.isAbsolute(rel)) return null;
  let ancestor = abs;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const actual = path.relative(root, realpathSync(ancestor));
  return actual === ".." || actual.startsWith(`..${path.sep}`) || path.isAbsolute(actual)
    ? null
    : abs;
}

function packageInfo(root) {
  const file = contained(root, "package.json");
  return file && existsSync(file) ? read(file) : {};
}

function dependencyRecipe(root, tool) {
  if (!contained(root, "node_modules"))
    return decision("dependency installation would modify a shared/outside-worktree node_modules");
  const lock = contained(root, "pnpm-lock.yaml");
  if (!lock) return decision("the pnpm lockfile resolves outside the worktree");
  if (!existsSync(lock))
    return diagnosis("locate the project lockfile before frozen dependency recovery");
  return {
    outcome: "AUTO",
    recipes: [
      recipe(
        "frozen-dependencies",
        ["pnpm", "install", "--frozen-lockfile"],
        tool ? ["pnpm", "exec", tool, "--version"] : ["pnpm", "list", "--depth", "0", "--json"],
        { frozen: true, ...(tool ? { path_prefix: path.join(root, "node_modules/.bin") } : {}) }
      )
    ]
  };
}

function cliPlan(root, policy, request, pkg) {
  const { tool } = request;
  const dep = PROJECT_TOOLS[tool];
  if (dep && (pkg.dependencies?.[dep] || pkg.devDependencies?.[dep])) {
    const dependencies = dependencyRecipe(root, tool);
    if (dependencies.outcome !== "AUTO") return dependencies;
    const probe = ["pnpm", "exec", tool, "--version"];
    return {
      outcome: "AUTO",
      recipes: [
        recipe("existing-project-tool", probe, probe, {
          path_prefix: path.join(root, "node_modules/.bin")
        }),
        ...dependencies.recipes
      ]
    };
  }
  if (tool === "pnpm") {
    const pin = /^pnpm@(\d+\.\d+\.\d+)(?:\+sha(?:224|256|512)\.[a-f0-9]+)?$/u.exec(
      pkg.packageManager ?? ""
    )?.[1];
    const prefix = contained(
      root,
      path.join(policy.raw.harness.logs_dir ?? "tasks/.logs", "tools")
    );
    if (!prefix) return decision("the tool installation prefix resolves outside the worktree");
    if (!pin)
      return diagnosis("resolve the project's exact pnpm packageManager pin before installing");
    const executable = path.join(prefix, "bin", "pnpm");
    return {
      outcome: "AUTO",
      recipes: [
        recipe(
          "pinned-pnpm",
          [
            "npm",
            "install",
            "--global",
            "--prefix",
            prefix,
            "--registry=https://registry.npmjs.org",
            "--ignore-scripts",
            `pnpm@${pin}`
          ],
          [executable, "--version"],
          { version: pin, path_prefix: path.join(prefix, "bin") }
        )
      ]
    };
  }
  if (
    Object.hasOwn(ORDINARY, tool ?? "") &&
    (request.platform ?? process.platform) === "darwin" &&
    !request.version
  ) {
    return {
      outcome: "AUTO",
      recipes: [
        recipe("brew-ordinary-tool", ["brew", "install", ORDINARY[tool]], [tool, "--version"])
      ]
    };
  }
  if (tool && !NAME.test(tool)) return decision("unsafe CLI argument identity");
  return diagnosis(
    "find another safe project/version/user-local installation path for this ordinary CLI"
  );
}

function historyPlan(root, policy, request) {
  if (!request.task_id)
    return diagnosis("reconstruct the durable task id from local task/git evidence");
  if (!/^[A-Z][A-Z0-9]*-[0-9]+$/u.test(request.task_id))
    return diagnosis("resolve the exact durable task id locally");
  const file = contained(root, path.join(policy.raw.harness.tasks_dir, `${request.task_id}.json`));
  if (!file) return decision("the durable task record resolves outside this worktree");
  if (!existsSync(file))
    return diagnosis("reconstruct the unavailable task record from local git/task evidence");
  const task = read(file);
  if (task.id !== request.task_id || !COMMIT.test(task.start_head ?? ""))
    return diagnosis("reconstruct the task's immutable start_head from local evidence");
  if (request.commit && request.commit !== task.start_head)
    return diagnosis("reconcile the requested commit with the durable task base");
  const commit = task.start_head;
  return {
    outcome: "AUTO",
    recipes: [
      recipe(
        "durable-task-history",
        ["git", "cat-file", "-e", `${commit}^{commit}`],
        ["git", "show", "--no-patch", "--format=%H", commit],
        { commit }
      ),
      recipe(
        "local-git-history",
        ["git", "fsck", "--full", "--no-reflogs"],
        ["git", "show", "--no-patch", "--format=%H", commit],
        { commit }
      )
    ]
  };
}

/** Request kinds: docker-stopped, missing-cli, dependencies, playwright-browser,
 * local-service {compose_file,service}, generated-artifacts {script,artifacts},
 * missing-history {task_id}. Underscore spellings are accepted for CLI JSON.
 * Plans never execute diagnostics, install anything, or treat attestations as evidence.
 */
export function recoveryPlan(root, policy, request) {
  if (!request || typeof request !== "object" || Array.isArray(request))
    throw violation("recovery request must be an object");
  root = realpathSync(root);
  const action = {
    ...request,
    kind: policy.raw.autonomy?.forbidden.includes(request.kind)
      ? request.kind
      : "local_development",
    target: {
      id: root,
      fingerprint: sha256(root),
      environment: request.environment ?? request.target?.environment ?? "local"
    }
  };
  const classification = classifyAction(policy, action);
  if (classification.class === "FORBIDDEN")
    throw violation(`FORBIDDEN recovery: ${classification.reason}`);
  if (classification.class !== "AUTO")
    return request.privileged ||
      request.paid ||
      request.public_exposure ||
      action.target.environment !== "local"
      ? decision(classification.reason)
      : diagnosis(classification.reason);
  if (request.sudo || request.privileged || request.system_wide)
    return decision("privileged/system-wide recovery needs a scoped decision");
  const suppliedKind = String(request.kind ?? request.failure ?? "").replaceAll("_", "-");
  const kind =
    {
      "missing-dependencies": "dependencies",
      "missing-browser": "playwright-browser",
      "missing-artifacts": "generated-artifacts",
      "local-service-stopped": request.compose_file ? "local-service" : "docker-stopped"
    }[suppliedKind] ?? suppliedKind;
  if (
    ["docker-stopped", "local-service"].includes(kind) &&
    process.env.DOCKER_HOST &&
    !localDocker(process.env.DOCKER_HOST)
  )
    return decision("remote Docker endpoint is not local AUTO recovery");
  try {
    const pkg = packageInfo(root);
    switch (kind) {
      case "docker-stopped": {
        const platform = request.platform ?? process.platform;
        if (!["darwin", "linux"].includes(platform))
          return diagnosis("diagnose another safe local runtime startup path for this platform");
        const primary =
          platform === "darwin"
            ? recipe("docker-desktop", ["open", "-a", "Docker"], ["docker", "info"])
            : recipe(
                "user-docker-service",
                ["systemctl", "--user", "start", "docker.service"],
                ["docker", "info"]
              );
        return {
          outcome: "AUTO",
          docker: true,
          recipes: [
            primary,
            recipe("existing-colima", ["colima", "start", "--activate=false"], ["docker", "info"])
          ]
        };
      }
      case "missing-cli":
        return cliPlan(root, policy, request, pkg);
      case "dependencies":
        return dependencyRecipe(root);
      case "playwright-browser": {
        if (
          !(
            pkg.dependencies?.["@playwright/test"] ||
            pkg.devDependencies?.["@playwright/test"] ||
            pkg.dependencies?.playwright ||
            pkg.devDependencies?.playwright
          )
        )
          return diagnosis(
            "locate the project's browser dependency and another safe browser installation path"
          );
        const module =
          pkg.dependencies?.["@playwright/test"] || pkg.devDependencies?.["@playwright/test"]
            ? "@playwright/test"
            : "playwright";
        return {
          outcome: "AUTO",
          recipes: [
            recipe(
              "playwright-chromium",
              ["pnpm", "exec", "playwright", "install", "chromium"],
              [
                "pnpm",
                "exec",
                "node",
                "--input-type=module",
                "-e",
                `const {chromium}=await import(${JSON.stringify(module)});const browser=await chromium.launch({headless:true,timeout:15000});await browser.close();`
              ]
            )
          ]
        };
      }
      case "local-service": {
        const file = contained(root, request.compose_file);
        if (
          !file ||
          !existsSync(file) ||
          !statSync(file).isFile() ||
          !NAME.test(request.service ?? "")
        )
          return request.compose_file && !file
            ? decision("Compose file resolves outside this worktree")
            : diagnosis("locate the local Compose file and exact service identity");
        if (request.project_name !== undefined && !PROJECT.test(request.project_name))
          return decision("invalid explicit Compose project_name");
        const compose = [
          "docker",
          "compose",
          "--file",
          file,
          ...(request.project_name ? ["--project-name", request.project_name] : [])
        ];
        return {
          outcome: "AUTO",
          docker: true,
          compose,
          compose_file: file,
          recipes: [
            recipe(
              "local-compose-service",
              [...compose, ...COMPOSE_START, request.service],
              [...compose, "ps", "--format", "json", request.service],
              { service: request.service }
            )
          ]
        };
      }
      case "generated-artifacts": {
        if (!contained(root, "node_modules"))
          return decision("generation could modify shared/outside-worktree node_modules");
        if (
          !/^(?:generate(?::[a-z0-9_-]+)*|[a-z0-9_-]+:generate)$/u.test(request.script ?? "") ||
          !Object.hasOwn(pkg.scripts ?? {}, request.script)
        )
          return /^(?:deploy|publish|clean|seed|migrate)(?::|$)/u.test(request.script ?? "")
            ? decision("requested script is not a safe artifact-generation operation")
            : diagnosis("locate a named existing package generation script");
        if (
          !Array.isArray(request.artifacts) ||
          !request.artifacts.length ||
          request.artifacts.length > 32
        )
          return diagnosis("identify the bounded local generated output paths");
        const artifacts = request.artifacts.map((file) => contained(root, file));
        if (artifacts.some((file) => !file))
          return decision("generated artifacts must remain within this worktree");
        const check =
          "const fs=await import('node:fs');const path=await import('node:path');const root=fs.realpathSync(process.cwd());for(const p of process.argv.slice(1)){const rel=path.relative(root,fs.realpathSync(p));if(rel==='..'||rel.startsWith('../')||path.isAbsolute(rel)||!fs.statSync(p).isFile()||fs.statSync(p).size===0)process.exit(1)}";
        return {
          outcome: "AUTO",
          recipes: [
            recipe(
              "package-generation",
              ["pnpm", "run", request.script],
              ["node", "--input-type=module", "-e", check, "--", ...artifacts]
            )
          ]
        };
      }
      case "missing-history":
        return historyPlan(root, policy, request);
      default:
        return diagnosis("diagnose locally and try another safe tool/path; no recipe exists yet");
    }
  } catch (error) {
    return diagnosis(`diagnose local recovery inputs: ${redact(error.message)}`);
  }
}

// ponytail: each process gets 60 seconds, including installs. Interrupted installs
// remain EXHAUSTED; a later explicit resume can retry, never an unbounded wait.
function execute(run, argv, root, env) {
  try {
    const result = run(argv, {
      cwd: root,
      env,
      shell: false,
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const code = result?.error || result?.signal ? -1 : (result?.status ?? result?.exit_code);
    return {
      exit_code: Number.isInteger(code) ? code : -1,
      stdout: String(result?.stdout ?? ""),
      message: redact(result?.error?.message ?? result?.stderr ?? "")
    };
  } catch (error) {
    return { exit_code: -1, stdout: "", message: redact(error.message) };
  }
}

function dockerContext(run, root, env, request) {
  let context = request.context ?? env.DOCKER_CONTEXT;
  if (!context) {
    const current = execute(run, ["docker", "context", "show"], root, env);
    if (current.exit_code !== 0) return { reason: "could not resolve the actual Docker context" };
    context = current.stdout.trim();
  }
  if (!NAME.test(context)) return { reason: "invalid Docker context identity" };
  const inspected = execute(
    run,
    ["docker", "context", "inspect", context, "--format", "{{json .Endpoints.docker.Host}}"],
    root,
    env
  );
  let host;
  try {
    host = JSON.parse(inspected.stdout);
  } catch {
    return { reason: "Docker context endpoint could not be verified" };
  }
  if (inspected.exit_code !== 0 || typeof host !== "string" || !host)
    return diagnosis("diagnose the unresolved local Docker endpoint identity");
  if (!localDocker(host) || (env.DOCKER_HOST && env.DOCKER_HOST !== host))
    return decision("remote or mismatched Docker endpoint is not AUTO recovery");
  return { context, argv: ["docker", "--context", context] };
}

function composeSafe(config, service, root) {
  const selected = config?.services?.[service];
  if (!selected || !IMAGE.test(selected.image ?? "")) return false;
  if (
    selected.privileged ||
    selected.network_mode === "host" ||
    selected.pid === "host" ||
    selected.cap_add?.length ||
    selected.devices?.length ||
    selected.entrypoint ||
    selected.build ||
    selected.secrets?.length
  )
    return false;
  if (
    selected.command &&
    (!Array.isArray(selected.command) ||
      !["postgres", "redis-server", "meilisearch"].includes(selected.command[0]))
  )
    return false;
  return (selected.volumes ?? []).every((volume) => {
    if (volume.type === "bind") return Boolean(contained(root, volume.source));
    const definition = config.volumes?.[volume.source];
    return volume.type === "volume" && !definition?.external;
  });
}

function jsonRows(stdout) {
  return stdout.trim().startsWith("[")
    ? JSON.parse(stdout)
    : stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
}

/** Prove the existing container belongs to THIS worktree. --no-recreate retains
 * its actual command, mounts and bindings; it never duplicates fixed names.
 * Docker/Compose labels are local machine evidence, not cryptographic identity.
 */
function existingCompose(run, root, env, docker, plan, config, request) {
  const project = request.project_name ?? config.name;
  if (!PROJECT.test(project ?? "") || config.name !== project)
    return { reason: "Compose project identity could not be resolved" };
  const service = config.services?.[request.service];
  if (!service || !IMAGE.test(service.image ?? ""))
    return diagnosis(
      "diagnose the existing service/image footprint before choosing a safe restart path"
    );
  if (!composeSafe(config, request.service, root))
    return decision("Compose has a privileged, external, or unsafe configured footprint");
  const compose = [
    ...docker.argv,
    "compose",
    "--file",
    plan.compose_file,
    "--project-name",
    project
  ];
  const listed = execute(
    run,
    [...compose, "ps", "--all", "--format", "json", request.service],
    root,
    env
  );
  if (listed.exit_code !== 0)
    return { reason: "existing Compose containers could not be inspected" };
  const rows = jsonRows(listed.stdout);
  if (!rows.length)
    return {
      reason: "restart requires existing owned containers; no new Compose project is created"
    };
  for (const row of rows) {
    if (!/^[a-f0-9]{12,64}$/u.test(row.ID ?? ""))
      return { reason: "existing Compose container identity is missing" };
    const inspected = execute(
      run,
      [...docker.argv, "inspect", "--format", "{{json .}}", row.ID],
      root,
      env
    );
    if (inspected.exit_code !== 0)
      return { reason: "existing Compose container could not be verified" };
    const container = JSON.parse(inspected.stdout);
    const labels = container.Config?.Labels ?? {};
    const workingDir = labels["com.docker.compose.project.working_dir"];
    const files = String(labels["com.docker.compose.project.config_files"] ?? "")
      .split(",")
      .map((file) => contained(root, file));
    if (
      labels["com.docker.compose.project"] !== project ||
      labels["com.docker.compose.service"] !== request.service ||
      !workingDir ||
      realpathSync(workingDir) !== root ||
      files.some((file) => !file) ||
      !files.map((file) => realpathSync(file)).includes(realpathSync(plan.compose_file))
    )
      return decision("Compose container belongs to another worktree/project or config identity");
    const selected = config.services[request.service];
    if (
      container.Config.Image !== selected.image ||
      (selected.container_name && container.Name !== `/${selected.container_name}`) ||
      (selected.command &&
        JSON.stringify(selected.command) !== JSON.stringify(container.Config.Cmd))
    )
      return {
        reason: "existing Compose image/name/command identity differs from the selected config"
      };
    if (!/^sha256:[a-f0-9]{64}$/u.test(container.Image ?? ""))
      return { reason: "immutable container image identity is unverified" };
    const image = execute(
      run,
      [...docker.argv, "image", "inspect", "--format", "{{json .Config}}", container.Image],
      root,
      env
    );
    if (image.exit_code !== 0)
      return { reason: "installed image configuration could not be inspected" };
    const defaults = JSON.parse(image.stdout);
    if (
      JSON.stringify(defaults.Entrypoint) !== JSON.stringify(container.Config.Entrypoint) ||
      (!selected.command && JSON.stringify(defaults.Cmd) !== JSON.stringify(container.Config.Cmd))
    )
      return decision("container command/entrypoint overrides have an unsafe execution footprint");
    if (container.Config.Env?.some((value) => /^(?:NODE_ENV|MEILI_ENV)=production$/u.test(value)))
      return decision("production-mode containers require a scoped decision");
    const host = container.HostConfig;
    if (!host) return diagnosis("inspect the container's actual local privilege footprint");
    if (
      host.Privileged ||
      host.NetworkMode === "host" ||
      host.PidMode === "host" ||
      host.CapAdd?.length ||
      host.Devices?.length ||
      host.SecurityOpt?.some((value) => value.includes("unconfined"))
    )
      return decision("existing container has a privileged footprint");
    if (
      Object.values(host.PortBindings ?? {})
        .flat()
        .some((binding) => !["127.0.0.1", "::1"].includes(binding.HostIp))
    )
      return decision("starting this container would expose non-loopback ports");
    for (const mount of container.Mounts ?? []) {
      if (mount.Type === "bind" && contained(root, mount.Source)) continue;
      if (mount.Type !== "volume" || !NAME.test(mount.Name ?? ""))
        return mount.Type === "bind"
          ? decision("container bind mount is outside this worktree")
          : diagnosis("inspect the existing container mount identity locally");
      const volume = execute(
        run,
        [...docker.argv, "volume", "inspect", "--format", "{{json .}}", mount.Name],
        root,
        env
      );
      if (
        volume.exit_code !== 0 ||
        JSON.parse(volume.stdout).Labels?.["com.docker.compose.project"] !== project
      )
        return { reason: "existing persistent volume ownership is unverified" };
      const users = execute(
        run,
        [...docker.argv, "ps", "--all", "--filter", `volume=${mount.Name}`, "--format", "{{.ID}}"],
        root,
        env
      );
      if (
        users.exit_code !== 0 ||
        users.stdout
          .trim()
          .split("\n")
          .some(
            (id) =>
              !id ||
              !rows.some(
                (selectedRow) => selectedRow.ID.startsWith(id) || id.startsWith(selectedRow.ID)
              )
          )
      )
        return users.exit_code !== 0
          ? diagnosis("inspect persistent volume attachments locally")
          : decision("persistent volume is shared with an unverified container");
    }
  }
  return { compose, project, containers: rows.map((row) => row.ID) };
}

function verifyResult(item, result) {
  if (result.exit_code !== 0) return false;
  if (item.version) return result.stdout.trim() === item.version;
  if (item.commit) return result.stdout.trim() === item.commit;
  if (item.service) {
    try {
      const rows = jsonRows(result.stdout);
      const matched = rows.map((row) => item.containers.find((id) => id.startsWith(row.ID ?? "") || (row.ID ?? "").startsWith(id)));
      return (
        rows.length === item.containers.length &&
        new Set(matched).size === item.containers.length &&
        rows.every(
          (row) =>
            /^[a-f0-9]{12,64}$/u.test(row.ID ?? "") &&
            item.containers.filter((id) => id.startsWith(row.ID) || row.ID.startsWith(id)).length === 1 &&
            row.Service === item.service &&
            row.State === "running" &&
            (!row.Health || row.Health === "healthy")
        )
      );
    } catch {
      return false;
    }
  }
  return true;
}

/** RECOVERED requires executed health AND the original goal's successful retry.
 * EXHAUSTED is local evidence only: the caller still needs external proof and
 * the existing blocker protocol before claiming any gate BLOCKED.
 */
export function recover(
  root,
  policy,
  request,
  {
    run = (argv, options) => spawnSync(argv[0], argv.slice(1), options),
    record = () => {},
    retry
  } = {}
) {
  root = realpathSync(root);
  const plan = recoveryPlan(root, policy, request);
  const attempts = [];
  if (plan.outcome !== "AUTO") return { outcome: plan.outcome, attempts, reason: plan.reason };
  const env = { ...process.env };
  let docker;
  if (plan.docker) {
    docker = dockerContext(run, root, env, request);
    if (docker.reason)
      return { outcome: docker.outcome ?? "NEEDS_DIAGNOSIS", attempts, reason: docker.reason };
    env.DOCKER_CONTEXT = docker.context;
  }
  let retried;
  let composeProject;
  const persist = (event) => {
    if (record(event)?.then)
      throw violation("synchronous recovery requires a synchronous durable record callback");
  };
  for (const original of plan.recipes) {
    let item = original;
    if (item.recipe === "existing-colima") {
      if (docker.context !== "colima") continue;
      const listed = execute(run, ["colima", "list", "--json"], root, env);
      try {
        const profiles = listed.stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .flatMap((line) => JSON.parse(line));
        if (listed.exit_code !== 0 || !profiles.some((profile) => profile.name === "default"))
          continue;
      } catch {
        continue;
      }
    }
    if (item.recipe === "user-docker-service") {
      const unit = execute(
        run,
        ["systemctl", "--user", "show", "docker.service", "--property=LoadState", "--value"],
        root,
        env
      );
      if (unit.exit_code !== 0 || unit.stdout.trim() !== "loaded") continue;
    }
    if (plan.compose) {
      const compose = [...docker.argv, ...plan.compose.slice(1)];
      const config = execute(run, [...compose, "config", "--format", "json"], root, env);
      try {
        if (config.exit_code !== 0)
          return {
            outcome: "NEEDS_DIAGNOSIS",
            attempts,
            reason: "Compose configuration could not be validated"
          };
        const existing = existingCompose(
          run,
          root,
          env,
          docker,
          plan,
          JSON.parse(config.stdout),
          request
        );
        if (existing.reason)
          return {
            outcome: existing.outcome ?? "NEEDS_DIAGNOSIS",
            attempts,
            reason: existing.reason
          };
        composeProject = existing.project;
        item = {
          ...item,
          containers: existing.containers,
          command: [...existing.compose, ...COMPOSE_START, request.service],
          verify: [...existing.compose, "ps", "--format", "json", request.service]
        };
      } catch {
        return {
          outcome: "NEEDS_DIAGNOSIS",
          attempts,
          reason: "Compose configuration could not be validated"
        };
      }
    } else if (plan.docker)
      item = {
        ...item,
        verify: ["node", "--input-type=module", "-e", DOCKER_READY, "--", docker.context, "info"]
      };
    if (item.path_prefix)
      env.PATH = `${item.path_prefix}${path.delimiter}${process.env.PATH ?? ""}`;
    const frozenFiles = item.frozen
      ? ["package.json", "pnpm-lock.yaml"].map((file) => [
          file,
          sha256(readFileSync(path.join(root, file)))
        ])
      : [];
    persist({ kind: "recovery_started", recipe: item.recipe, command: item.command, at: nowIso() });
    const executed = execute(run, item.command, root, env);
    const health = execute(run, item.verify, root, env);
    let unchanged = true;
    if (frozenFiles.length) {
      try {
        unchanged = frozenFiles.every(
          ([file, digest]) => sha256(readFileSync(path.join(root, file))) === digest
        );
      } catch {
        unchanged = false;
      }
    }
    const attempt = {
      recipe: item.recipe,
      command: item.command,
      exit_code: executed.exit_code,
      verification_exit: health.exit_code,
      verified: executed.exit_code === 0 && verifyResult(item, health) && unchanged
    };
    attempts.push(attempt);
    persist({
      kind: "recovery_attempt",
      ...attempt,
      verification_command: item.verify,
      message: redact(
        [
          executed.message,
          health.message,
          unchanged ? "" : "frozen dependency inputs changed"
        ].join(" ")
      ),
      at: nowIso()
    });
    if (!attempt.verified || typeof retry !== "function") continue;
    try {
      const result = retry({
        root,
        env,
        recipe: item.recipe,
        ...(item.commit ? { commit: item.commit } : {}),
        ...(docker ? { context: docker.context } : {}),
        ...(composeProject ? { project_name: composeProject } : {})
      });
      const code = result?.error || result?.signal ? -1 : (result?.status ?? result?.exit_code);
      retried = { exit_code: Number.isInteger(code) ? code : -1 };
    } catch (error) {
      retried = { exit_code: -1, message: redact(error.message) };
    }
    persist({ kind: "recovery_retry", ...retried, recipe: item.recipe, at: nowIso() });
    if (retried.exit_code === 0) return { outcome: "RECOVERED", attempts, retry: retried };
  }
  return {
    outcome: attempts.length ? "EXHAUSTED" : "NEEDS_DIAGNOSIS",
    attempts,
    ...(retried ? { retry: retried } : {}),
    ...(!attempts.length
      ? { reason: "no existing nonprivileged local runtime could be verified" }
      : {})
  };
}
