module.exports = {
  apps: [
    // M15: NestJS API (nihongo-api) removed — Go API serves all endpoints on :4001.
    // Preserved in apps/api/ for rollback reference only.
    {
      name: "nihongo-web",
      cwd: "/home/deploy/nihongo-bjt",
      script: "./deploy/gcp/start-app.sh",
      args: "@nihongo-bjt/web",
      env: { NODE_ENV: "production" },
    },
    {
      name: "nihongo-admin",
      cwd: "/home/deploy/nihongo-bjt",
      script: "./deploy/gcp/start-app.sh",
      args: "@nihongo-bjt/admin",
      env: { NODE_ENV: "production" },
    },
  ],
};
