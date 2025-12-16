# Docker Setup Guide

This guide explains how to run the Binary System application using Docker.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed (included with Docker Desktop)

## Project Structure

- **Backend**: Node.js/Express server (Port 8000)
- **Frontend**: Next.js application (Port 3000)

## Quick Start

1. **Create Environment File**

   Create a `.env` file in the root directory with the following variables:

   ```env
   MONGODB_URL_DEVELOPMENT=mongodb://localhost:27017/binary_system
   ACCESS_TOKEN_SECRET=your_access_token_secret
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   ALLOWED_ORIGINS=http://localhost:3000
   ```

   **Note**: Make sure MongoDB is running and accessible. If MongoDB is in Docker, you may need to add it to docker-compose.yml.

2. **Build and Run with Docker Compose**

   ```bash
   # Production build
   docker-compose up --build

   # Or in detached mode
   docker-compose up -d --build
   ```

3. **Development Mode (with hot reload)**

   ```bash
   docker-compose -f docker-compose.dev.yml up --build
   ```

   This will:
   - Build both backend and frontend images
   - Start both containers
   - Expose backend on port 8000
   - Expose frontend on port 3000

3. **Run in Detached Mode**

   ```bash
   docker-compose up -d --build
   ```

4. **Stop the Containers**

   ```bash
   docker-compose down
   ```

## Individual Service Commands

### Backend Only

```bash
# Build backend image
docker build -t binary-system-backend ./server

# Run backend container
docker run -p 8000:8000 \
  -e MONGODB_URL_DEVELOPMENT=mongodb://localhost:27017/binary_system \
  -e ACCESS_TOKEN_SECRET=your_secret \
  -e REFRESH_TOKEN_SECRET=your_secret \
  binary-system-backend
```

### Frontend Only

```bash
# Build frontend image (with standalone mode)
docker build -t binary-system-frontend --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 ./client

# Or use the simpler Dockerfile (if standalone mode has issues)
docker build -t binary-system-frontend -f Dockerfile.simple --build-arg NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 ./client

# Run frontend container
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1 \
  binary-system-frontend
```

**Note**: The main Dockerfile uses Next.js standalone mode for smaller production images. If you encounter issues, you can use `Dockerfile.simple` instead by updating `docker-compose.yml` to reference it.

## Environment Variables

### Backend Environment Variables

- `PORT`: Server port (default: 8000)
- `MONGODB_URL_DEVELOPMENT`: MongoDB connection string
- `ACCESS_TOKEN_SECRET`: JWT access token secret
- `REFRESH_TOKEN_SECRET`: JWT refresh token secret
- `ALLOWED_ORIGINS`: CORS allowed origins (default: http://localhost:3000)

### Frontend Environment Variables

- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:8000/api/v1)

## Accessing the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000/api/v1
- **Health Check**: http://localhost:8000/api/health

## Useful Docker Commands

```bash
# View running containers
docker ps

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart a service
docker-compose restart backend
docker-compose restart frontend

# Stop and remove containers
docker-compose down

# Stop and remove containers, volumes, and images
docker-compose down -v --rmi all

# Rebuild without cache
docker-compose build --no-cache

# Execute command in running container
docker-compose exec backend sh
docker-compose exec frontend sh
```

## Troubleshooting

### Port Already in Use

If ports 8000 or 3000 are already in use, you can modify the port mappings in `docker-compose.yml`:

```yaml
ports:
  - "8001:8000"  # Change 8001 to any available port
```

### Build Errors

1. Clear Docker cache:
   ```bash
   docker system prune -a
   ```

2. Rebuild without cache:
   ```bash
   docker-compose build --no-cache
   ```

### MongoDB Connection Issues

Make sure MongoDB is accessible. If MongoDB is running in Docker, you may need to:

1. Add MongoDB service to `docker-compose.yml`
2. Update `MONGODB_URL_DEVELOPMENT` to use the service name instead of `localhost`

### Frontend Can't Connect to Backend

If running in Docker, update `NEXT_PUBLIC_API_URL` in `docker-compose.yml` to use the backend service name:

```yaml
environment:
  - NEXT_PUBLIC_API_URL=http://backend:8000/api/v1
```

However, since Next.js builds environment variables at build time, you'll need to rebuild the frontend image after changing this.

## Development Mode

For development with hot reload, you may want to mount volumes and use development commands:

```yaml
# In docker-compose.yml, add volumes for development
volumes:
  - ./server:/usr/src/app
  - /usr/src/app/node_modules
```

Then override the command:
```yaml
command: npm run dev
```

## Production Deployment

For production:

1. Set `NODE_ENV=production`
2. Use proper secrets management
3. Configure proper CORS origins
4. Set up proper database connections
5. Use reverse proxy (nginx) if needed
6. Configure SSL/TLS certificates
