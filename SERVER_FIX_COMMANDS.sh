#!/bin/bash
# Quick Fix Script for Server Build Issues
# Run this script on your server to fix the build problems

set -e

echo "🔧 Fixing Docker Build Issues..."
echo ""

# Navigate to project directory
cd /root/webapps/binary_system || { echo "Error: Directory not found. Please update the path."; exit 1; }

echo "1️⃣  Updating frontend Dockerfile to use Node.js 20..."
sed -i 's/node:18-alpine/node:20-alpine/g' client/Dockerfile

echo "2️⃣  Verifying Node version in Dockerfile..."
if grep -q "node:20-alpine" client/Dockerfile; then
    echo "   ✅ Dockerfile updated successfully"
else
    echo "   ⚠️  Warning: Dockerfile might not have been updated. Please check manually."
fi

echo ""
echo "3️⃣  Creating .npmrc for better network handling..."
cat > client/.npmrc << 'EOF'
registry=https://registry.npmjs.org/
fetch-timeout=300000
fetch-retry-mintimeout=20000
fetch-retry-maxtimeout=120000
maxsockets=10
EOF
echo "   ✅ .npmrc created"

echo ""
echo "4️⃣  Stopping existing containers..."
docker compose down 2>/dev/null || true

echo ""
echo "5️⃣  Cleaning up Docker cache..."
docker system prune -f

echo ""
echo "6️⃣  Rebuilding images with no cache..."
echo "   This may take several minutes..."
DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1 docker compose build --no-cache

echo ""
echo "7️⃣  Starting containers..."
docker compose up -d

echo ""
echo "✅ Build process completed!"
echo ""
echo "📊 Checking container status..."
docker compose ps

echo ""
echo "📋 To view logs, run:"
echo "   docker compose logs -f"
echo ""
echo "🔍 To check specific service logs:"
echo "   docker compose logs -f backend"
echo "   docker compose logs -f frontend"
