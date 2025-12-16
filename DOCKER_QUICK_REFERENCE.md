# Docker Quick Reference
## Binary System - Common Commands

## 🚀 Quick Start

```bash
# Navigate to project directory
cd /opt/binary_system

# Build images
docker compose build

# Start services
docker compose up -d

# View logs
docker compose logs -f
```

---

## 📦 Building

```bash
# Build all services
docker compose build

# Build specific service
docker compose build backend
docker compose build frontend

# Build without cache (fresh build)
docker compose build --no-cache
```

---

## ▶️ Starting & Stopping

```bash
# Start services (detached mode)
docker compose up -d

# Start with logs visible
docker compose up

# Stop services
docker compose stop

# Stop and remove containers
docker compose down

# Stop, remove containers and volumes
docker compose down -v

# Restart all services
docker compose restart

# Restart specific service
docker compose restart backend
docker compose restart frontend
```

---

## 📊 Monitoring

```bash
# View all logs
docker compose logs -f

# View logs for specific service
docker compose logs -f backend
docker compose logs -f frontend

# View last N lines
docker compose logs --tail=100

# View logs with timestamps
docker compose logs -f -t

# Check container status
docker compose ps

# Resource usage
docker stats

# Container details
docker inspect binary-system-backend
docker inspect binary-system-frontend
```

---

## 🔧 Troubleshooting

```bash
# View container logs
docker compose logs backend | tail -50
docker compose logs frontend | tail -50

# Execute command in container
docker compose exec backend sh
docker compose exec frontend sh

# Check environment variables in container
docker compose exec backend env | grep MONGODB

# Rebuild and restart
docker compose down
docker compose build --no-cache
docker compose up -d

# Check if ports are in use
sudo lsof -i :8000
sudo lsof -i :3000

# Test backend health
curl http://localhost:8000/api/health

# Test frontend
curl http://localhost:3000
```

---

## 🧹 Cleanup

```bash
# Remove stopped containers
docker container prune

# Remove unused images
docker image prune -a

# Remove unused volumes
docker volume prune

# Remove everything (careful!)
docker system prune -a --volumes
```

---

## 🔄 Updates

```bash
# Pull latest code (if using git)
git pull

# Rebuild images
docker compose build

# Restart with new images
docker compose up -d

# View new logs
docker compose logs -f
```

---

## 🔐 Environment

```bash
# View environment variables from .env
cat .env

# Edit .env file
nano .env

# Secure .env file
chmod 600 .env

# Verify environment variables are loaded
docker compose config
```

---

## 📝 Useful Commands

```bash
# List all containers
docker ps -a

# List all images
docker images

# Remove specific container
docker rm binary-system-backend

# Remove specific image
docker rmi binary_system-backend:latest

# View container resource limits
docker stats --no-stream

# Export container logs to file
docker compose logs > logs.txt

# Follow logs for specific time
timeout 60 docker compose logs -f
```

---

## 🆘 Emergency Commands

```bash
# Force stop all containers
docker compose kill

# Remove everything and start fresh
docker compose down -v
docker system prune -a
docker compose build --no-cache
docker compose up -d

# Check disk space
df -h
docker system df

# Check memory usage
free -h
docker stats --no-stream
```
