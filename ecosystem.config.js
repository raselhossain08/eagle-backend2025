module.exports = {
  apps: [{
    name: 'eagle-backend',
    script: 'server.js',
    instances: 2, // Use cluster mode for better performance
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development',
      PORT: 5000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      // Environment variables will be loaded from .env.production
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    // Restart delay
    restart_delay: 4000,
    // Maximum number of restarts within 15 minutes
    max_restarts: 10,
    min_uptime: '10s',
    // Health check
    health_check_grace_period: 3000,
    // Advanced PM2 features
    merge_logs: true,
    source_map_support: true,
    instance_var: 'INSTANCE_ID'
  }],

  deploy: {
    production: {
      user: 'root',
      host: 'galaxygate.net',
      ref: 'origin/main',
      repo: 'https://github.com/raselhossain08/eagle.git',
      path: '/var/www/eagle-backend',
      'pre-deploy-local': '',
      'post-deploy': 'cd backend && npm install --production && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
