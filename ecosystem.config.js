module.exports = {
  apps: [
    {
      name: 'mission-control',
      script: './app/server.js',
      cwd: '/root/.openclaw/workspace/mission-control',
      max_memory_restart: '256M',
      restart_delay: 3000,
      max_restarts: 10,
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'mc-mcp',
      script: './app/mcp-server.js',
      cwd: '/root/.openclaw/workspace/mission-control',
      max_memory_restart: '128M',
      restart_delay: 3000,
      max_restarts: 10,
      merge_logs: true,
      env: {
        NODE_ENV: 'production',
        MCP_PORT: 3002,
      },
    },
  ],
};
