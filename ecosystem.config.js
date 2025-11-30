module.exports = {
  apps: [{
    name: 'ISerPublicApi',
    script: './main.js',
    // env_inherit: true, // 不存在
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'production',
      // 继承所有当前环境变量
      ...process.env
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '200M',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm Z'
  }]
};