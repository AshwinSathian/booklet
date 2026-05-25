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

      out_file: `${LOGS}/readable-app-out.log`,
      error_file: `${LOGS}/readable-app-err.log`,
      merge_logs: true,
      time: true,
    },

    // ─── MCP server (Node.js bridge) ─────────────────────────────────────────
    {
      name: "readable-mcp",
      // Use the tsx binary installed inside mcp-server's own node_modules
      script: `${BASE}/mcp-server/node_modules/.bin/tsx`,
      args: "src/node-server.ts",
      cwd: `${BASE}/mcp-server`,
      interpreter: "none",

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

      out_file: `${LOGS}/readable-mcp-out.log`,
      error_file: `${LOGS}/readable-mcp-err.log`,
      merge_logs: true,
      time: true,
    },
  ],
};
