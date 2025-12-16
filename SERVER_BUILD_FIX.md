# Server Build Issues - Fix Guide

## Issue 1: Node.js Version Mismatch

**Error:** `You are using Node.js 18.20.8. For Next.js, Node.js version ">=20.9.0" is required.`

**Solution:** The frontend Dockerfile must use Node.js 20 instead of Node.js 18.

### Fix the Dockerfile:

The frontend Dockerfile should use `node:20-alpine` instead of `node:18-alpine`.

Verify your `/root/webapps/binary_system/client/Dockerfile` first line is:
```dockerfile
FROM node:20-alpine AS base
```

If it shows `node:18-alpine`, update it:

```bash
cd /root/webapps/binary_system/client
sed -i 's/node:18-alpine/node:20-alpine/g' Dockerfile
```

Or manually edit the file:
```bash
nano /root/webapps/binary_system/client/Dockerfile
```

Change the first line from:
```dockerfile
FROM node:18-alpine AS base
```

To:
```dockerfile
FROM node:20-alpine AS base
```

---

## Issue 2: Network Timeout During npm install

**Error:** `npm error network read ETIMEDOUT`

This happens when npm can't download packages due to network issues.

### Solution 1: Use npm registry with longer timeout

Create or update the Dockerfile to set npm registry and timeout:

Add these lines in the Dockerfile before `RUN npm ci`:

```dockerfile
# Set npm registry and increase timeout
RUN npm config set registry https://registry.npmjs.org/
RUN npm config set fetch-timeout 300000
RUN npm config set fetch-retry-mintimeout 20000
RUN npm config set fetch-retry-maxtimeout 120000
```

### Solution 2: Use .npmrc file

Create a `.npmrc` file in the client directory:

```bash
cd /root/webapps/binary_system/client
cat > .npmrc << EOF
registry=https://registry.npmjs.org/
fetch-timeout=300000
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
maxsockets=10
EOF
```

### Solution 3: Update Dockerfile with network retry logic

Here's an updated frontend Dockerfile that handles network issues better:

```dockerfile
# Frontend Dockerfile - Multi-stage build
FROM node:20-alpine AS base

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

# Install with retry logic
RUN npm ci --prefer-offline --no-audit || \
    (sleep 5 && npm ci --prefer-offline --no-audit) || \
    (sleep 10 && npm ci --prefer-offline --no-audit)

# Builder stage
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set environment variable for build time
ARG NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application
RUN npm run build

# Runner stage
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy built application
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Start the application using the standalone server
CMD ["node", "server.js"]
```

---

## Quick Fix Commands for Server

Run these commands on your server:

```bash
cd /root/webapps/binary_system

# 1. Update frontend Dockerfile to use Node 20
sed -i 's/node:18-alpine/node:20-alpine/g' client/Dockerfile

# 2. Create .npmrc for better network handling
cat > client/.npmrc << 'EOF'
registry=https://registry.npmjs.org/
fetch-timeout=300000
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
maxsockets=10
EOF

# 3. Clean up previous failed builds
docker compose down
docker system prune -f

# 4. Rebuild with no cache
docker compose build --no-cache

# 5. Start containers
docker compose up -d

# 6. Check logs
docker compose logs -f
```

---

## Alternative: Use Docker BuildKit with better caching

If network issues persist, try:

```bash
# Enable BuildKit for better caching and network handling
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1

# Build with BuildKit
docker compose build --no-cache
```

---

## Check Your Current Dockerfile

Verify the Dockerfile has the correct Node version:

```bash
cd /root/webapps/binary_system/client
head -3 Dockerfile
```

Should show:
```
FROM node:20-alpine AS base
```

If it shows `node:18-alpine`, you need to update it.

---

## Network Troubleshooting

If network issues continue:

1. **Check DNS resolution:**
   ```bash
   docker run --rm node:20-alpine nslookup registry.npmjs.org
   ```

2. **Test npm registry access:**
   ```bash
   docker run --rm node:20-alpine npm ping
   ```

3. **Check if behind proxy:**
   If your server is behind a corporate proxy, configure Docker to use it:
   ```bash
   # Create/edit /etc/docker/daemon.json
   sudo nano /etc/docker/daemon.json
   ```
   
   Add:
   ```json
   {
     "proxies": {
       "http-proxy": "http://proxy.example.com:8080",
       "https-proxy": "http://proxy.example.com:8080",
       "no-proxy": "localhost,127.0.0.1"
     }
   }
   ```
   
   Then restart Docker:
   ```bash
   sudo systemctl restart docker
   ```

4. **Use a different npm registry (if needed):**
   ```dockerfile
   RUN npm config set registry https://registry.npmmirror.com/
   ```

---

## Summary

The two main fixes needed:

1. ✅ Change `node:18-alpine` to `node:20-alpine` in frontend Dockerfile
2. ✅ Add npm configuration for better network timeout handling

After making these changes, rebuild the images:
```bash
docker compose build --no-cache
docker compose up -d
```
