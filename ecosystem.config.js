const BASE = "/Users/ashwinsathian/Documents/Personal/readable/readable";
const LOGS = `${process.env.HOME}/.pm2/logs`;

/** @type {import('pm2').StartOptions[]} */
module.exports = {
  apps: [
    // ─── Main Next.js application ────────────────────────────────────────────
    {
      name: "readable-app",
      script: `${BASE}/node_modules/.bin/next`,
      args: "start -p 3100",
      cwd: BASE,
      interpreter: "none",

      env_production: {
        NODE_ENV: "production",
        PORT: "3100",
      },
      env: {
        NODE_ENV: "production",
        PORT: "3100",
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

      out_file: `${LOGS}/readable-app-out.log`,
      error_file: `${LOGS}/readable-app-err.log`,
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },

    // ─── MCP server (Node.js bridge) ─────────────────────────────────────────
    {
      name: "readable-mcp",
      // Resolve the tsx binary via npx rather than a hardcoded node_modules/.bin
      // path — under npm workspaces (see PLAN-backend-auth-migration.md), a
      // dependency shared across workspaces (tsx is also used transitively
      // elsewhere) can get hoisted to the repo root's node_modules/.bin
      // instead of staying nested under mcp-server/node_modules/.bin, and
      // which one happens is not guaranteed stable across `npm install` runs.
      // A hardcoded path silently breaks (ENOENT) the moment hoisting shifts;
      // npx resolves through normal Node module resolution regardless of
      // where it landed.
      script: "npx",
      args: "tsx src/node-server.ts",
      cwd: `${BASE}/mcp-server`,
      interpreter: "none",

      env_production: {
        NODE_ENV: "production",
        PORT: "8788",
        READABLE_API_BASE: "http://localhost:3100",
        MCP_SERVER_NAME: "readable",
        MCP_SERVER_VERSION: "1.0.0",
      },
      env: {
        NODE_ENV: "production",
        PORT: "8788",
        // Loopback — no tunnel round-trip for internal calls
        READABLE_API_BASE: "http://localhost:3100",
        MCP_SERVER_NAME: "readable",
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

      out_file: `${LOGS}/readable-mcp-out.log`,
      error_file: `${LOGS}/readable-mcp-err.log`,
      merge_logs: true,
      time: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
