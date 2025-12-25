# Process Management Guide

For long-term autonomous operation, the system should be run with a process manager that automatically restarts it on crashes or system reboots.

## PM2 (Recommended for Node.js)

PM2 is a production process manager for Node.js applications with built-in load balancer.

### Installation

```bash
npm install -g pm2
```

### Basic Usage

**Start the system:**
```bash
pm2 start npm --name "biible-ags" -- run ags:run
```

**Start with environment variables:**
```bash
pm2 start npm --name "biible-ags" -- run ags:run --env production
```

**View logs:**
```bash
pm2 logs biible-ags
```

**Monitor:**
```bash
pm2 monit
```

**Stop:**
```bash
pm2 stop biible-ags
```

**Restart:**
```bash
pm2 restart biible-ags
```

**Delete:**
```bash
pm2 delete biible-ags
```

### PM2 Ecosystem File

Create `ecosystem.config.js` in the project root:

```javascript
module.exports = {
  apps: [{
    name: 'biible-ags',
    script: 'npm',
    args: 'run ags:run',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      GH_TOKEN: process.env.GH_TOKEN,
      CONTENT_REPO: process.env.CONTENT_REPO,
      CLOUD_MODE: 'true'
    },
    error_file: './logs/pm2-error.log',
    out_file: './logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    time: true
  }]
}
```

**Start with ecosystem file:**
```bash
pm2 start ecosystem.config.js
```

**Save PM2 configuration:**
```bash
pm2 save
```

**Setup startup script (auto-start on reboot):**
```bash
pm2 startup
# Follow the instructions it prints
pm2 save
```

### PM2 Commands Reference

- `pm2 list` - List all processes
- `pm2 info biible-ags` - Detailed process info
- `pm2 logs biible-ags --lines 100` - Last 100 log lines
- `pm2 flush` - Clear all logs
- `pm2 reload biible-ags` - Zero-downtime reload
- `pm2 kill` - Kill PM2 daemon

## systemd (Linux)

For Linux systems, you can create a systemd service.

### Create Service File

Create `/etc/systemd/system/biible-ags.service`:

```ini
[Unit]
Description=Biible Autonomous Growth System
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/biible-growth-system
Environment="OPENAI_API_KEY=your-key"
Environment="GH_TOKEN=your-token"
Environment="CONTENT_REPO=yourusername/biible-content-site"
Environment="CLOUD_MODE=true"
ExecStart=/usr/bin/npm run ags:run
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

### systemd Commands

**Enable and start:**
```bash
sudo systemctl enable biible-ags
sudo systemctl start biible-ags
```

**Check status:**
```bash
sudo systemctl status biible-ags
```

**View logs:**
```bash
sudo journalctl -u biible-ags -f
```

**Restart:**
```bash
sudo systemctl restart biible-ags
```

**Stop:**
```bash
sudo systemctl stop biible-ags
```

## Docker (Alternative)

For containerized deployments, create a `Dockerfile`:

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .

RUN npm run build

CMD ["node", "dist/index.js"]
```

**Build and run:**
```bash
docker build -t biible-ags .
docker run -d --name biible-ags --restart unless-stopped \
  -e OPENAI_API_KEY=your-key \
  -e GH_TOKEN=your-token \
  -e CONTENT_REPO=yourusername/biible-content-site \
  -e CLOUD_MODE=true \
  -v $(pwd)/data:/app/data \
  biible-ags
```

## Health Checks

The system performs internal health checks, but for external monitoring:

**Check if process is running:**
```bash
# PM2
pm2 describe biible-ags | grep status

# systemd
systemctl is-active biible-ags

# Docker
docker ps | grep biible-ags
```

**Check system health via logs:**
```bash
# Look for health check messages
pm2 logs biible-ags --lines 50 | grep "Health Monitor"
```

## Monitoring Recommendations

1. **Set up alerts** for process crashes
2. **Monitor memory usage** (PM2 has built-in monitoring)
3. **Check logs regularly** for error patterns
4. **Monitor API quota** to prevent mid-run failures
5. **Set up disk space alerts** for data directory

## Troubleshooting

**Process keeps restarting:**
- Check logs for error patterns
- Verify environment variables are set
- Check API keys are valid
- Review health check recommendations

**High memory usage:**
- Check for memory leaks in logs
- Consider restarting periodically (PM2: `max_memory_restart`)
- Review agent health metrics

**Process won't start:**
- Verify Node.js version (requires Node 20+)
- Check all dependencies are installed
- Verify file permissions on data directory

