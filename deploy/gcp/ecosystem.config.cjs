module.exports = {
  apps: [
    {
      name: "nihongo-api",
      cwd: "/home/deploy/nihongo-bjt",
      script: "./deploy/gcp/start-app.sh",
      args: "@nihongo-bjt/api",
      env: { NODE_ENV: "production" },
    },
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
