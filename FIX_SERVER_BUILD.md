# Fix Server Build Issues

## Problems Identified

1. **Node.js Version Mismatch**: Frontend Dockerfile uses Node 18, but Next.js 16 requires Node 20
2. **Network Timeout**: npm install fails due to network connectivity issues

## Quick Fix (Run on Server)

```bash
cd /root/webapps/binary_system

# Fix 1: Update Dockerfile to use Node 20
sed -i 's/node:18-alpine/node:20-alpine/g' client/Dockerfile

# Fix 2: Create .npmrc for better network handling
cat > client/.npmrc << 'EOF'
registry=https://registry.npmjs.org/
fetch-timeout=300000
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
maxsockets=10
EOF

# Fix 3: Update Dockerfile to handle network retries (see below)

# Clean and rebuild
docker compose down
docker system prune -f
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose build --no-cache
docker compose up -d
```

## Manual Fix: Update Frontend Dockerfile

The frontend Dockerfile on the server needs to be updated. The updated version is in the repository, but you can also manually edit:

```bash
nano /root/webapps/binary_system/client/Dockerfile
```

Ensure it uses Node 20 and includes npm retry logic. The updated deps section should look like this:

```dockerfile
# Install dependencies stage
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Configure npm for better network handling
RUN npm config set registry https://registry.npmjs.org/ && \
    npm config set fetch-timeout 300000 && \
    npm config set fetch-retry-mintimeout 20000 && \
    npm config set fetch-retry-maxtimeout 120000 && \
    npm config set maxsockets 10

# Copy package files
COPY package*.json ./

# Install dependencies with retry logic for network issues
RUN npm ci --prefer-offline --no-audit || \
    (sleep 5 && npm ci --prefer-offline --no-audit) || \
    (sleep 10 && npm ci --prefer-offline --no-audit)
```

## Verify Fixes

After updating, verify:

```bash
# Check Node version in Dockerfile
grep "FROM node" client/Dockerfile
# Should show: FROM node:20-alpine AS base

# Check .npmrc exists
cat client/.npmrc

# Rebuild
docker compose build --no-cache frontend

# Check logs for errors
docker compose logs frontend
```

## Alternative: Upload Updated Files

If you have the updated files locally, upload them to the server:

```bash
# From your local machine
scp client/Dockerfile user@server:/root/webapps/binary_system/client/Dockerfile
```

Then rebuild on the server.
