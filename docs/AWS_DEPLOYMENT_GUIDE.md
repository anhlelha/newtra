# AWS EC2 Deployment Guide
# Cryptocurrency Trading Bot

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [EC2 Instance Setup](#ec2-instance-setup)
3. [Server Configuration](#server-configuration)
4. [Application Deployment](#application-deployment)
5. [Nginx & SSL Setup](#nginx--ssl-setup)
6. [Monitoring & Maintenance](#monitoring--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## 1. Prerequisites

### 1.1 AWS Account
- Active AWS account
- IAM user with EC2 access
- AWS CLI configured (optional)

### 1.2 Local Requirements
- SSH client
- Domain name (for SSL)
- Binance API credentials
- TradingView account

### 1.3 Estimated Costs
- EC2 t3.small: ~$15/month
- Data transfer: ~$5/month
- EBS storage (20GB): ~$2/month
- **Total: ~$22/month**

---

## 2. EC2 Instance Setup

### 2.1 Launch EC2 Instance

**Step 1: Login to AWS Console**
1. Go to https://console.aws.amazon.com
2. Navigate to EC2 Dashboard
3. Click "Launch Instance"

**Step 2: Choose AMI**
- Select: **Ubuntu Server 22.04 LTS (HVM), SSD Volume Type**
- Architecture: **64-bit (x86)**

**Step 3: Choose Instance Type**
- Select: **t3.small** (2 vCPU, 2GB RAM)
- For testing: t3.micro (1 vCPU, 1GB RAM)

**Step 4: Configure Instance**
```
- Number of instances: 1
- Network: Default VPC
- Auto-assign Public IP: Enable
- IAM role: None (or create one for CloudWatch)
- Monitoring: Enable detailed monitoring (optional)
- Termination protection: Enable
```

**Step 5: Add Storage**
```
- Size: 20 GB
- Volume Type: gp3 (General Purpose SSD)
- Delete on Termination: No (for data safety)
- Encryption: Enable (optional)
```

**Step 6: Add Tags**
```
Name: trading-bot-production
Environment: production
Application: crypto-trading-bot
```

**Step 7: Configure Security Group**
```
Security Group Name: trading-bot-sg

Inbound Rules:
┌──────────┬──────────┬──────┬─────────────────┬─────────────┐
│ Type     │ Protocol │ Port │ Source          │ Description │
├──────────┼──────────┼──────┼─────────────────┼─────────────┤
│ SSH      │ TCP      │ 22   │ Your IP/32      │ SSH access  │
│ HTTP     │ TCP      │ 80   │ 0.0.0.0/0       │ HTTP        │
│ HTTPS    │ TCP      │ 443  │ 0.0.0.0/0       │ HTTPS       │
└──────────┴──────────┴──────┴─────────────────┴─────────────┘

Outbound Rules:
All traffic allowed (default)
```

**Step 8: Review and Launch**
1. Review configuration
2. Click "Launch"
3. Create new key pair or use existing
   - Key pair name: `trading-bot-key`
   - Key pair type: RSA
   - File format: .pem
4. Download .pem file (keep it safe!)
5. Click "Launch Instances"

### 2.2 Elastic IP (Optional but Recommended)

**Why?** Fixed IP address survives instance restarts

**Steps:**
1. Go to EC2 → Elastic IPs
2. Click "Allocate Elastic IP address"
3. Click "Allocate"
4. Select the new IP → Actions → Associate Elastic IP address
5. Select your instance
6. Click "Associate"

### 2.3 Connect to Instance

**Chmod key file (first time):**
```bash
chmod 400 trading-bot-key.pem
```

**SSH into instance:**
```bash
ssh -i trading-bot-key.pem ubuntu@YOUR_ELASTIC_IP
```

---

## 3. Server Configuration

### 3.1 Initial Server Setup

**Update system:**
```bash
sudo apt update
sudo apt upgrade -y
```

**Install Node.js 18.x:**
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Should show v18.x.x
npm --version
```

**Install essential tools:**
```bash
sudo apt install -y \
  git \
  build-essential \
  nginx \
  sqlite3 \
  ufw \
  curl \
  wget \
  htop \
  certbot \
  python3-certbot-nginx
```

**Install PM2 globally:**
```bash
sudo npm install -g pm2
pm2 --version
```

### 3.2 Configure Firewall (UFW)

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw --force enable

# Check status
sudo ufw status
```

**Output should show:**
```
Status: active

To                         Action      From
--                         ------      ----
22/tcp                     ALLOW       Anywhere
80/tcp                     ALLOW       Anywhere
443/tcp                    ALLOW       Anywhere
```

### 3.3 Create Application User (Optional)

```bash
# Create dedicated user
sudo useradd -m -s /bin/bash tradingbot
sudo usermod -aG sudo tradingbot

# Set password
sudo passwd tradingbot

# Switch to user
sudo su - tradingbot
```

### 3.4 Setup Directory Structure

```bash
# Create app directory
sudo mkdir -p /opt/trading-bot
sudo chown -R ubuntu:ubuntu /opt/trading-bot

# Create log directory
sudo mkdir -p /var/log/trading-bot
sudo chown -R ubuntu:ubuntu /var/log/trading-bot

# Create data directory
sudo mkdir -p /var/lib/trading-bot
sudo chown -R ubuntu:ubuntu /var/lib/trading-bot

# Create backup directory
sudo mkdir -p /backups/trading-bot
sudo chown -R ubuntu:ubuntu /backups/trading-bot
```

### 3.5 Configure System Limits

**Increase file descriptors:**
```bash
sudo tee -a /etc/security/limits.conf <<EOF
ubuntu soft nofile 65536
ubuntu hard nofile 65536
EOF
```

**Increase connection tracking:**
```bash
sudo tee -a /etc/sysctl.conf <<EOF
net.ipv4.tcp_tw_reuse = 1
net.ipv4.ip_local_port_range = 10000 65000
net.core.somaxconn = 4096
EOF

sudo sysctl -p
```

---

## 4. Application Deployment

### 4.1 Clone Repository

```bash
cd /opt/trading-bot
git clone https://github.com/your-username/crypto-trading-bot.git .

# Or if using SSH
git clone git@github.com:your-username/crypto-trading-bot.git .
```

### 4.2 Install Dependencies

```bash
cd /opt/trading-bot
npm ci --production
```

### 4.3 Setup Environment Variables

```bash
nano /opt/trading-bot/.env
```

**Add following content:**
```bash
# Server
NODE_ENV=production
PORT=3000

# Binance API
BINANCE_API_KEY=your_binance_api_key_here
BINANCE_API_SECRET=your_binance_api_secret_here
BINANCE_TESTNET=false

# TradingView
TRADINGVIEW_WEBHOOK_SECRET=your_random_secret_here

# Admin API
ADMIN_API_KEY=your_admin_api_key_here

# Trading Configuration
TRADING_ENABLED=true
DEFAULT_POSITION_SIZE_PERCENT=2
MAX_POSITION_SIZE_PERCENT=5
MAX_TOTAL_EXPOSURE_PERCENT=50
MAX_DAILY_LOSS=1000
ENABLE_STOP_LOSS=true
DEFAULT_STOP_LOSS_PERCENT=2
PREVENT_DUPLICATES_WINDOW_MS=30000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Logging
LOG_LEVEL=info
LOG_FILE=/var/log/trading-bot/app.log

# Database
DATABASE_PATH=/var/lib/trading-bot/database.sqlite
```

**Save:** Ctrl+O, Enter, Ctrl+X

**Secure .env file:**
```bash
chmod 600 /opt/trading-bot/.env
```

### 4.4 Build Application

```bash
cd /opt/trading-bot
npm run build
```

### 4.5 Initialize Database

```bash
cd /opt/trading-bot
npm run migrate
# or
node dist/database/migrate.js
```

### 4.6 Test Application

```bash
# Test run
NODE_ENV=production node dist/index.js

# Should see:
# Server listening on port 3000
# Connected to database
# Trading bot started successfully
```

**Test in another terminal:**
```bash
curl http://localhost:3000/api/health
```

**Expected response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-12T10:30:00.000Z",
  "uptime": 5,
  "checks": {
    "database": true,
    "binance": true,
    "disk": true,
    "memory": true
  }
}
```

Stop the test with Ctrl+C

### 4.7 Configure PM2

**Create PM2 config:**
```bash
nano /opt/trading-bot/ecosystem.config.js
```

**Add:**
```javascript
module.exports = {
  apps: [{
    name: 'trading-bot',
    script: './dist/index.js',
    instances: 2,
    exec_mode: 'cluster',
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/trading-bot/pm2-error.log',
    out_file: '/var/log/trading-bot/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    min_uptime: '10s',
    max_restarts: 10
  }]
};
```

**Start with PM2:**
```bash
cd /opt/trading-bot
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

**Check status:**
```bash
pm2 status
pm2 logs
```

---

## 5. Nginx & SSL Setup

### 5.1 Configure DNS

**Before SSL, point your domain to EC2:**
1. Go to your domain registrar
2. Create A record:
   - Name: `@` or `bot` (e.g., bot.yourdomain.com)
   - Value: Your Elastic IP
   - TTL: 300

**Verify DNS propagation:**
```bash
nslookup bot.yourdomain.com
# Should return your EC2 IP
```

### 5.2 Configure Nginx

**Create Nginx config:**
```bash
sudo nano /etc/nginx/sites-available/trading-bot
```

**Add:**
```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=webhook:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;

# Upstream (load balancing)
upstream trading_bot {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    keepalive 32;
}

# HTTP server (redirect to HTTPS)
server {
    listen 80;
    listen [::]:80;
    server_name bot.yourdomain.com;

    # Allow Certbot
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    # Redirect to HTTPS
    location / {
        return 301 https://$server_name$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name bot.yourdomain.com;

    # SSL certificates (will be added by Certbot)
    # ssl_certificate /etc/letsencrypt/live/bot.yourdomain.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/bot.yourdomain.com/privkey.pem;

    # SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;

    # Max body size
    client_max_body_size 1M;

    # TradingView webhook
    location /webhook/ {
        limit_req zone=webhook burst=20 nodelay;

        proxy_pass http://trading_bot;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Admin API
    location /api/ {
        limit_req zone=api burst=20 nodelay;

        proxy_pass http://trading_bot;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Health check (no rate limit)
    location = /api/health {
        proxy_pass http://trading_bot;
        proxy_http_version 1.1;
        access_log off;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/trading-bot /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

**Test configuration:**
```bash
sudo nginx -t
```

**Restart Nginx:**
```bash
sudo systemctl restart nginx
sudo systemctl enable nginx
```

### 5.3 Obtain SSL Certificate

**Run Certbot:**
```bash
sudo certbot --nginx -d bot.yourdomain.com
```

**Follow prompts:**
1. Enter email address
2. Agree to Terms of Service
3. Choose whether to share email
4. Select option 2: Redirect HTTP to HTTPS

**Verify auto-renewal:**
```bash
sudo certbot renew --dry-run
```

**Check certificate:**
```bash
sudo certbot certificates
```

### 5.4 Test HTTPS

```bash
curl https://bot.yourdomain.com/api/health
```

**Should return health status over HTTPS**

---

## 6. Monitoring & Maintenance

### 6.1 Setup Log Rotation

**Create logrotate config:**
```bash
sudo nano /etc/logrotate.d/trading-bot
```

**Add:**
```
/var/log/trading-bot/*.log {
    daily
    rotate 30
    compress
    delaycompress
    notifempty
    missingok
    create 0640 ubuntu ubuntu
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

**Test:**
```bash
sudo logrotate -d /etc/logrotate.d/trading-bot
```

### 6.2 Setup Database Backup

**Create backup script:**
```bash
sudo nano /usr/local/bin/backup-trading-bot.sh
```

**Add:**
```bash
#!/bin/bash

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/trading-bot"
DB_PATH="/var/lib/trading-bot/database.sqlite"
LOG_FILE="/var/log/trading-bot/backup.log"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup database
echo "[$(date)] Starting backup..." >> $LOG_FILE
sqlite3 $DB_PATH ".backup $BACKUP_DIR/db_$DATE.sqlite" 2>> $LOG_FILE

if [ $? -eq 0 ]; then
    # Compress
    gzip $BACKUP_DIR/db_$DATE.sqlite
    echo "[$(date)] Backup successful: db_$DATE.sqlite.gz" >> $LOG_FILE

    # Optional: Upload to S3
    # aws s3 cp $BACKUP_DIR/db_$DATE.sqlite.gz s3://your-bucket/backups/

    # Delete old backups (keep 30 days)
    find $BACKUP_DIR -name "db_*.sqlite.gz" -mtime +30 -delete
    echo "[$(date)] Old backups cleaned" >> $LOG_FILE
else
    echo "[$(date)] Backup failed!" >> $LOG_FILE
    exit 1
fi
```

**Make executable:**
```bash
sudo chmod +x /usr/local/bin/backup-trading-bot.sh
```

**Test:**
```bash
sudo /usr/local/bin/backup-trading-bot.sh
ls -lh /backups/trading-bot/
```

### 6.3 Setup Cron Jobs

**Edit crontab:**
```bash
crontab -e
```

**Add:**
```cron
# Backup database daily at 2 AM
0 2 * * * /usr/local/bin/backup-trading-bot.sh

# Health check every 5 minutes
*/5 * * * * curl -f https://bot.yourdomain.com/api/health || echo "Health check failed" | mail -s "Trading Bot Health Alert" your@email.com

# PM2 save every hour
0 * * * * pm2 save

# Check disk space daily
0 3 * * * df -h | grep -E "/$|/var" | awk '$5+0 > 80 {print "Disk usage alert: " $0}' | mail -s "Disk Space Alert" your@email.com
```

### 6.4 PM2 Monitoring

**View logs:**
```bash
pm2 logs trading-bot
pm2 logs trading-bot --lines 100
pm2 logs trading-bot --err  # errors only
```

**Monitor resources:**
```bash
pm2 monit
```

**View detailed info:**
```bash
pm2 show trading-bot
```

**Restart app:**
```bash
pm2 restart trading-bot
pm2 reload trading-bot  # zero-downtime reload
```

### 6.5 System Monitoring

**Install monitoring tools:**
```bash
sudo apt install -y htop iotop nethogs
```

**Check CPU/Memory:**
```bash
htop
```

**Check disk usage:**
```bash
df -h
du -sh /var/log/trading-bot/*
du -sh /var/lib/trading-bot/*
```

**Check network:**
```bash
sudo nethogs  # Real-time network usage
netstat -tuln | grep :3000  # Check port
```

**Check Nginx:**
```bash
sudo systemctl status nginx
sudo nginx -t
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### 6.6 Application Monitoring

**Check application logs:**
```bash
tail -f /var/log/trading-bot/app.log
tail -f /var/log/trading-bot/error.log
```

**Query database:**
```bash
sqlite3 /var/lib/trading-bot/database.sqlite

-- Check recent orders
SELECT * FROM orders ORDER BY created_at DESC LIMIT 10;

-- Check open positions
SELECT * FROM positions WHERE status = 'OPEN';

-- Check today's PnL
SELECT SUM(realized_pnl) as total_pnl
FROM positions
WHERE DATE(closed_at) = DATE('now');
```

---

## 7. Troubleshooting

### 7.1 Common Issues

#### Issue: Application not starting

**Check PM2 logs:**
```bash
pm2 logs trading-bot --err
```

**Common causes:**
- Missing environment variables
- Database file permissions
- Port already in use
- Node modules not installed

**Solutions:**
```bash
# Check .env file
cat /opt/trading-bot/.env

# Check file permissions
ls -la /var/lib/trading-bot/

# Check if port is in use
sudo lsof -i :3000

# Reinstall dependencies
cd /opt/trading-bot
rm -rf node_modules package-lock.json
npm install
npm run build
```

#### Issue: SSL certificate error

**Check certificate:**
```bash
sudo certbot certificates
```

**Renew certificate:**
```bash
sudo certbot renew
sudo systemctl reload nginx
```

#### Issue: Webhook not receiving requests

**Check Nginx logs:**
```bash
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

**Test webhook locally:**
```bash
curl -X POST https://bot.yourdomain.com/webhook/tradingview \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your_secret" \
  -d '{"action":"buy","symbol":"BTCUSDT","orderType":"market"}'
```

**Check application logs:**
```bash
grep "webhook" /var/log/trading-bot/app.log
```

#### Issue: High memory usage

**Check PM2 memory:**
```bash
pm2 list
```

**Reduce instances if needed:**
```javascript
// ecosystem.config.js
instances: 1,  // Reduce from 2 to 1
max_memory_restart: '300M'  // Reduce limit
```

**Restart:**
```bash
pm2 restart trading-bot
```

#### Issue: Binance API errors

**Check Binance status:**
```bash
curl https://api.binance.com/api/v3/ping
```

**Check API keys:**
```bash
# Test API key (in your app)
curl https://bot.yourdomain.com/api/balance \
  -H "Authorization: Bearer your_admin_api_key"
```

**Check IP restrictions:**
- Go to Binance → API Management
- Check if IP restrictions are enabled
- Add your EC2 Elastic IP if needed

### 7.2 Emergency Procedures

#### Stop all trading immediately

```bash
# Method 1: Via API
curl -X POST https://bot.yourdomain.com/api/config \
  -H "Authorization: Bearer your_admin_api_key" \
  -H "Content-Type: application/json" \
  -d '{"trading.enabled": false}'

# Method 2: Environment variable
nano /opt/trading-bot/.env
# Change: TRADING_ENABLED=false
pm2 restart trading-bot

# Method 3: Stop application
pm2 stop trading-bot
```

#### Cancel all open orders

```bash
# Via admin API
curl -X POST https://bot.yourdomain.com/api/orders/cancel-all \
  -H "Authorization: Bearer your_admin_api_key"

# Or manually on Binance
# Go to Binance → Spot → Open Orders → Cancel All
```

#### Restore from backup

```bash
# Stop application
pm2 stop trading-bot

# Restore database
cd /backups/trading-bot
gunzip -c db_20251112_020000.sqlite.gz > /var/lib/trading-bot/database.sqlite

# Restart application
pm2 start trading-bot
```

### 7.3 Performance Tuning

**Optimize Nginx:**
```nginx
worker_processes auto;
worker_connections 1024;
keepalive_timeout 65;
gzip on;
gzip_types application/json text/plain;
```

**Optimize PM2:**
```javascript
// ecosystem.config.js
max_memory_restart: '400M',
kill_timeout: 5000,
listen_timeout: 10000,
```

**Optimize SQLite:**
```sql
-- Run these periodically
PRAGMA optimize;
VACUUM;
ANALYZE;
```

**Monitor and adjust:**
```bash
# Watch system resources
watch -n 1 'pm2 list && free -h && df -h'
```

---

## 8. Security Checklist

- [ ] SSH key-based authentication only (disable password)
- [ ] Firewall (UFW) enabled
- [ ] Security group configured properly
- [ ] SSL certificate installed and auto-renewing
- [ ] Environment variables secured (chmod 600)
- [ ] Binance API keys have IP restrictions
- [ ] Admin API key is strong and random
- [ ] Webhook secret is strong and random
- [ ] Rate limiting enabled
- [ ] Regular security updates
- [ ] Backups automated and tested
- [ ] Monitoring and alerts configured
- [ ] Logs are rotated and cleaned
- [ ] Non-root user for application (optional)

---

## 9. Maintenance Schedule

**Daily:**
- Check application logs for errors
- Verify health check endpoint
- Monitor open positions

**Weekly:**
- Review trading performance
- Check disk space
- Review error logs
- Update dependencies if needed

**Monthly:**
- Review and update risk parameters
- Check and renew SSL certificate (automated)
- Review system performance
- Update system packages
- Test backup restoration
- Security audit

---

## 10. Useful Commands Cheat Sheet

```bash
# Application
pm2 start trading-bot
pm2 stop trading-bot
pm2 restart trading-bot
pm2 logs trading-bot
pm2 monit

# Nginx
sudo systemctl restart nginx
sudo nginx -t
tail -f /var/log/nginx/access.log

# SSL
sudo certbot renew
sudo certbot certificates

# Database
sqlite3 /var/lib/trading-bot/database.sqlite
.tables
.schema orders

# Logs
tail -f /var/log/trading-bot/app.log
grep "ERROR" /var/log/trading-bot/app.log

# System
df -h
free -h
htop
sudo ufw status

# Backup
/usr/local/bin/backup-trading-bot.sh
ls -lh /backups/trading-bot/
```

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
**Maintainer:** DevOps Team
