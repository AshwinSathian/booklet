const BASE = "/Users/ashwinsathian/Documents/Personal/booklet";
const LOGS = `${process.env.HOME}/.pm2/logs`;
// Both apps name their interpreter, so the Node version does not depend on
// which Node the PM2 daemon happened to be started under. Keep in step with
// .nvmrc and NODE_BIN in scripts/redeploy.sh and scripts/pm2-startup.sh.
const NODE_BIN = `${process.env.HOME}/.nvm/versions/node/v24.19.0/bin`;
const NODE = `${NODE_BIN}/node`;
const PATH = `${NODE_BIN}:${process.env.PATH}`;

/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    // ─── Main Next.js application ────────────────────────────────────────────
    {
      name: "booklet-app",
      script: `${BASE}/node_modules/next/dist/bin/next`,
      args: "start -p 3100",
      cwd: BASE,
      interpreter: NODE,

      env_production: {
        NODE_ENV: "production",
        PORT: "3100",
        PATH,
      },
      env: {
        NODE_ENV: "production",
        PORT: "3100",
        PATH,
      },

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,

      // Allow MongoDB and system services to settle after boot
      restart_delay: 3000,
      min_uptime: "10s",
      max_restarts: 15,
      max_memory_restart: "1G",
      kill_timeout: 5000,

      out_file: `${LOGS}/booklet-app-out.log`,
      error_file: `${LOGS}/booklet-app-err.log`,
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },

    // ─── MCP server (Node.js bridge) ─────────────────────────────────────────
    {
      name: "booklet-mcp",
      // tsx is loaded with --import, so Node resolves it through normal
      // module resolution wherever npm workspaces hoisted it (a hardcoded
      // node_modules/.bin/tsx path broke when hoisting moved it).
      script: "src/node-server.ts",
      cwd: `${BASE}/mcp-server`,
      interpreter: NODE,
      node_args: "--import tsx",

      env_production: {
        NODE_ENV: "production",
        PORT: "8788",
        BOOKLET_API_BASE: "http://localhost:3100",
        MCP_SERVER_NAME: "booklet",
        PATH,
        MCP_SERVER_VERSION: "1.0.0",
      },
      env: {
        NODE_ENV: "production",
        PORT: "8788",
        // Loopback — no tunnel round-trip for internal calls
        BOOKLET_API_BASE: "http://localhost:3100",
        MCP_SERVER_NAME: "booklet",
        PATH,
        MCP_SERVER_VERSION: "1.0.0",
      },

      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,

      restart_delay: 2000,
      min_uptime: "5s",
      max_restarts: 15,
      max_memory_restart: "256M",
      kill_timeout: 3000,

      out_file: `${LOGS}/booklet-mcp-out.log`,
      error_file: `${LOGS}/booklet-mcp-err.log`,
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
