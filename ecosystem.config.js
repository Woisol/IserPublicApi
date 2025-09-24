module.exports = {
  apps: [{
    name: 'IserPublicApi',
    script: 'main.js',
    cwd: process.env.SERVER_LOCAL_PATH || '~/servers/iser-public-api',
    env: {
      NODE_ENV: 'production',
      SERVER_PORT: process.env.SERVER_PORT || 3000,
      AUTHORITY_API_KEY: process.env.AUTHORITY_API_KEY,
      WXWORK_WEBHOOK_URL: process.env.WXWORK_WEBHOOK_URL
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '200M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};