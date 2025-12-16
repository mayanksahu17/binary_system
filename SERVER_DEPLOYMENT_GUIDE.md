# Server Deployment Guide
## Binary System - Docker Deployment

This guide covers deploying the Binary System application on a production server using Docker and Docker Compose.

---

## 📋 Prerequisites

### Server Requirements

- **Operating System**: Ubuntu 20.04 LTS or later (recommended), or any Linux distribution with Docker support
- **RAM**: Minimum 2GB (4GB recommended)
- **CPU**: 2 cores minimum
- **Storage**: 20GB free space minimum
- **Network**: Public IP address with ports 8000 (backend) and 3000 (frontend) accessible
  - Or configure reverse proxy (nginx) to expose ports 80/443

### Software Requirements

- Docker Engine 20.10+ 
- Docker Compose 2.0+
- Git (for cloning repository)
- Basic knowledge of Linux command line

---

## 🔧 Step 1: Install Docker and Docker Compose

### For Ubuntu/Debian:

```bash
# Update system packages
sudo apt-get update

# Install required packages
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version

# Add current user to docker group (to run docker without sudo)
sudo usermod -aG docker $USER
# Log out and log back in for this to take effect
```

### For CentOS/RHEL:

```bash
# Install required packages
sudo yum install -y yum-utils

# Add Docker repository
sudo yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo

# Install Docker
sudo yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Start Docker
sudo systemctl start docker
sudo systemctl enable docker

# Verify installation
docker --version
docker compose version

# Add user to docker group
sudo usermod -aG docker $USER
```

---

## 📦 Step 2: Clone Repository and Setup

```bash
# Navigate to a suitable directory
cd /opt  # or /var/www or your preferred location

# Clone the repository (or upload files via SCP/SFTP)
# git clone <your-repository-url> binary_system
# OR if you have the files locally, upload them via SCP:
# scp -r /path/to/binary_system user@server:/opt/

# Navigate to project directory
cd binary_system

# Ensure you have the following structure:
# binary_system/
#   ├── client/
#   ├── server/
#   ├── docker-compose.yml
#   └── .env
```

---

## 🔐 Step 3: Configure Environment Variables

Create a `.env` file in the root directory (`/opt/binary_system/.env`):

```bash
# Create .env file
nano .env
```

### Required Environment Variables:

```env
# Application Configuration
NODE_ENV=production
PORT=8000
CLIENT_URL=http://your-domain.com:3000
API_URL=http://your-domain.com:8000

# JWT Secrets (Generate strong random strings)
ACCESS_TOKEN_SECRET=your_very_secure_access_token_secret_here
REFRESH_TOKEN_SECRET=your_very_secure_refresh_token_secret_here
ADMIN_JWT_SECRET=your_secure_admin_secret_key
ADMIN_JWT_EXPIRES_IN=7d

# MongoDB Connection
# Replace with your actual MongoDB connection string
MONGODB_URL_DEVELOPMENT=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/newdb
MONGODB_URL_PRODUCTION=mongodb+srv://username:password@cluster0.xxxxx.mongodb.net/newdb

# Redis Configuration
REDIS_USERNAME=default
REDIS_PASSWORD=your_redis_password
REDIS_HOST=your_redis_host
REDIS_PORT=your_redis_port

# Email Configuration (for sending emails)
EMAIL_USER=your_email@example.com
EMAIL_PASS=your_email_password

# NOWPayments Configuration (if using)
NOWPAYMENTS_API_KEY=your_nowpayments_api_key
NOWPAYMENTS_API_URL=https://api.nowpayments.io/v1
NOWPAYMENTS_CALLBACK_URL=http://your-domain.com:8000/api/v1/payment/callback

# CORS Configuration
ALLOWED_ORIGINS=http://your-domain.com:3000,http://your-domain.com
```

### Generate Secure Secrets:

```bash
# Generate random secrets (use these for ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET)
openssl rand -base64 32
openssl rand -base64 32
```

### Secure the .env file:

```bash
# Set proper permissions (only owner can read/write)
chmod 600 .env
```

---

## 🐳 Step 4: Build and Run Docker Containers

### Build the Images:

```bash
# Build both backend and frontend images
docker compose build

# Or build without cache (if you want a fresh build)
docker compose build --no-cache
```

### Start the Containers:

```bash
# Start containers in detached mode (background)
docker compose up -d

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f backend
docker compose logs -f frontend
```

### Verify Containers are Running:

```bash
# Check container status
docker compose ps

# Should show:
# NAME                      STATUS          PORTS
# binary-system-backend     Up              0.0.0.0:8000->8000/tcp
# binary-system-frontend    Up              0.0.0.0:3000->3000/tcp
```

### Test the Services:

```bash
# Test backend API
curl http://localhost:8000/api/health
# Should return: {"status":"success","message":"API OK"}

# Test frontend (should return HTML)
curl http://localhost:3000
```

---

## 🌐 Step 5: Configure Reverse Proxy (Optional but Recommended)

Using Nginx as reverse proxy for production:

### Install Nginx:

```bash
sudo apt-get install -y nginx
```

### Create Nginx Configuration:

```bash
sudo nano /etc/nginx/sites-available/binary-system
```

### Configuration File Content:

```nginx
# Backend API (Port 8000)
upstream backend {
    server localhost:8000;
}

# Frontend (Port 3000)
upstream frontend {
    server localhost:3000;
}

# HTTP to HTTPS redirect (if using SSL)
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;
    
    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

# HTTPS Configuration (if using SSL)
server {
    listen 443 ssl http2;
    server_name your-domain.com www.your-domain.com;

    # SSL Certificate paths (update these)
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Backend API
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend
    location / {
        proxy_pass http://frontend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Increase timeouts for long-running requests
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;
}
```

### Enable Site and Test:

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/binary-system /etc/nginx/sites-enabled/

# Test Nginx configuration
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔒 Step 6: SSL Certificate (Optional but Recommended)

### Using Let's Encrypt (Free SSL):

```bash
# Install Certbot
sudo apt-get install -y certbot python3-certbot-nginx

# Obtain certificate (replace with your domain)
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot will automatically configure Nginx
# Certificates auto-renew via cron job
```

---

## 🔥 Step 7: Configure Firewall

```bash
# If using UFW (Ubuntu)
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
# If not using reverse proxy:
sudo ufw allow 3000/tcp    # Frontend
sudo ufw allow 8000/tcp    # Backend

# Enable firewall
sudo ufw enable
sudo ufw status
```

---

## 🔄 Step 8: Setup Auto-Start on Boot

Docker Compose containers should automatically start on boot by default. To ensure:

```bash
# Check if docker service starts on boot
sudo systemctl enable docker

# Docker Compose v2 uses restart policies in docker-compose.yml
# Ensure your docker-compose.yml has: restart: unless-stopped
```

---

## 📊 Step 9: Monitoring and Logs

### View Logs:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f backend
docker compose logs -f frontend

# Last 100 lines
docker compose logs --tail=100

# Logs with timestamps
docker compose logs -f -t
```

### Container Status:

```bash
# List running containers
docker compose ps

# Container resource usage
docker stats

# Inspect container
docker inspect binary-system-backend
```

---

## 🛠️ Step 10: Maintenance Commands

### Stop Services:

```bash
# Stop containers
docker compose stop

# Stop and remove containers
docker compose down

# Stop, remove containers and volumes
docker compose down -v
```

### Restart Services:

```bash
# Restart all services
docker compose restart

# Restart specific service
docker compose restart backend
docker compose restart frontend
```

### Update Application:

```bash
# Pull latest code (if using git)
git pull

# Rebuild images
docker compose build

# Restart with new images
docker compose up -d
```

### Clean Up:

```bash
# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything (containers, images, volumes, networks)
docker system prune -a --volumes
```

---

## 🐛 Troubleshooting

### Backend Not Connecting to MongoDB:

1. **Check MongoDB connection string:**
   ```bash
   # Verify .env file has correct MongoDB URL
   grep MONGODB_URL_DEVELOPMENT .env
   ```

2. **Test MongoDB connection:**
   ```bash
   # Check backend logs
   docker compose logs backend | grep -i mongodb
   ```

3. **Verify MongoDB allows connections from your server IP:**
   - Check MongoDB Atlas network access settings
   - Whitelist your server's IP address

### Frontend Not Loading:

1. **Check frontend logs:**
   ```bash
   docker compose logs frontend
   ```

2. **Verify frontend is accessible:**
   ```bash
   curl http://localhost:3000
   ```

3. **Check NEXT_PUBLIC_API_URL in .env:**
   - Should match your backend URL

### Containers Keep Restarting:

1. **Check logs for errors:**
   ```bash
   docker compose logs --tail=50
   ```

2. **Check container status:**
   ```bash
   docker compose ps
   ```

3. **Check system resources:**
   ```bash
   free -h
   df -h
   ```

### Port Already in Use:

```bash
# Find process using port
sudo lsof -i :8000
sudo lsof -i :3000

# Kill process (replace PID)
sudo kill -9 <PID>

# Or change ports in docker-compose.yml
```

### Permission Issues:

```bash
# Fix Docker permissions
sudo usermod -aG docker $USER
# Log out and log back in

# Fix file permissions
sudo chown -R $USER:$USER /opt/binary_system
```

---

## 📝 Environment Variables Reference

### Required Variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Backend port | `8000` |
| `ACCESS_TOKEN_SECRET` | JWT access token secret | `random_string_32_chars` |
| `REFRESH_TOKEN_SECRET` | JWT refresh token secret | `random_string_32_chars` |
| `MONGODB_URL_DEVELOPMENT` | MongoDB connection string | `mongodb+srv://user:pass@cluster.net/db` |
| `MONGODB_URL_PRODUCTION` | MongoDB production URL | `mongodb+srv://user:pass@cluster.net/db` |

### Optional Variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `CLIENT_URL` | Frontend URL | `http://localhost:3000` |
| `API_URL` | Backend API URL | `http://localhost:8000` |
| `EMAIL_USER` | Email username | - |
| `EMAIL_PASS` | Email password | - |
| `REDIS_HOST` | Redis host | - |
| `REDIS_PORT` | Redis port | - |
| `REDIS_PASSWORD` | Redis password | - |

---

## 🔐 Security Best Practices

1. **Keep .env file secure:**
   ```bash
   chmod 600 .env
   # Don't commit .env to git
   ```

2. **Use strong secrets:**
   - Generate random strings for JWT secrets
   - Use different secrets for development and production

3. **Keep Docker updated:**
   ```bash
   sudo apt-get update
   sudo apt-get upgrade docker-ce docker-ce-cli
   ```

4. **Regular backups:**
   - Backup MongoDB database regularly
   - Backup .env file securely

5. **Monitor logs:**
   - Set up log rotation
   - Monitor for suspicious activity

6. **Use HTTPS:**
   - Always use SSL/TLS in production
   - Configure proper SSL certificates

---

## 📞 Support and Verification

### Health Check Endpoints:

- **Backend Health:** `http://your-domain.com/api/health`
- **Backend API Docs:** `http://your-domain.com/api/docs` (if enabled)

### Verify Deployment:

1. ✅ Backend API responds to health check
2. ✅ Frontend loads in browser
3. ✅ MongoDB connection successful (check logs)
4. ✅ Redis connection successful (check logs)
5. ✅ Can login/create accounts
6. ✅ Database operations work correctly

---

## 🚀 Quick Start Checklist

- [ ] Install Docker and Docker Compose
- [ ] Clone/upload project files to server
- [ ] Create `.env` file with all required variables
- [ ] Secure `.env` file (chmod 600)
- [ ] Build Docker images (`docker compose build`)
- [ ] Start containers (`docker compose up -d`)
- [ ] Verify containers are running (`docker compose ps`)
- [ ] Test backend API (`curl http://localhost:8000/api/health`)
- [ ] Test frontend (`curl http://localhost:3000`)
- [ ] Configure firewall (if needed)
- [ ] Setup reverse proxy (optional but recommended)
- [ ] Configure SSL certificate (optional but recommended)
- [ ] Verify application works end-to-end

---

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Nginx Documentation](https://nginx.org/en/docs/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

**Last Updated:** December 16, 2025  
**Version:** 1.0.0
